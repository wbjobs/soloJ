use std::fs;
use std::path::PathBuf;
use tracing::{info, warn, debug};
use crate::types::*;
use crate::AppResult;
use super::parser::{BookParser, generate_id, create_element, create_chapter};

pub struct EpubParser;

impl EpubParser {
    pub fn new() -> Self {
        EpubParser
    }
    
    fn parse_opf(&self, opf_content: &str) -> AppResult<(BookMetadata, Vec<String>)> {
        let mut metadata = BookMetadata::default();
        let mut manifest: Vec<String> = Vec::new();
        
        let reader = xml::EventReader::from_str(opf_content);
        
        let mut current_tag = String::new();
        let mut in_metadata = false;
        let mut in_manifest = false;
        let mut current_text = String::new();
        
        for event in reader {
            match event.map_err(|e| AppError::ParseError(format!("XML parse error: {}", e)))? {
                xml::reader::XmlEvent::StartElement { name, attributes, .. } => {
                    current_tag = name.local_name.clone();
                    
                    match current_tag.as_str() {
                        "metadata" => in_metadata = true,
                        "manifest" => in_manifest = true,
                        "item" if in_manifest => {
                            if let Some(href) = attributes.iter().find(|a| a.name.local_name == "href") {
                                manifest.push(href.value.clone());
                            }
                        }
                        _ => {}
                    }
                }
                xml::reader::XmlEvent::EndElement { name, .. } => {
                    match name.local_name.as_str() {
                        "metadata" => in_metadata = false,
                        "manifest" => in_manifest = false,
                        "title" if in_metadata => {
                            metadata.title = current_text.trim().to_string();
                            current_text.clear();
                        }
                        "creator" if in_metadata => {
                            let author = current_text.trim().to_string();
                            if !author.is_empty() {
                                metadata.authors.push(author);
                            }
                            current_text.clear();
                        }
                        "publisher" if in_metadata => {
                            let publisher = current_text.trim().to_string();
                            if !publisher.is_empty() {
                                metadata.publisher = Some(publisher);
                            }
                            current_text.clear();
                        }
                        "date" if in_metadata => {
                            let date = current_text.trim().to_string();
                            if !date.is_empty() {
                                metadata.publish_date = Some(date);
                            }
                            current_text.clear();
                        }
                        "identifier" if in_metadata => {
                            let id = current_text.trim().to_string();
                            if id.starts_with("ISBN:") || id.len() == 10 || id.len() == 13 {
                                metadata.isbn = Some(id);
                            }
                            current_text.clear();
                        }
                        "language" if in_metadata => {
                            let lang = current_text.trim().to_string();
                            if !lang.is_empty() {
                                metadata.language = Some(lang);
                            }
                            current_text.clear();
                        }
                        "description" if in_metadata => {
                            let desc = current_text.trim().to_string();
                            if !desc.is_empty() {
                                metadata.description = Some(desc);
                            }
                            current_text.clear();
                        }
                        "subject" if in_metadata => {
                            let tag = current_text.trim().to_string();
                            if !tag.is_empty() {
                                metadata.tags.push(tag);
                            }
                            current_text.clear();
                        }
                        _ => {}
                    }
                }
                xml::reader::XmlEvent::Characters(text) => {
                    if in_metadata {
                        current_text.push_str(&text);
                    }
                }
                _ => {}
            }
        }
        
        Ok((metadata, manifest))
    }
    
    fn parse_xhtml(&self, content: &str, chapter_order: u32, title: &str) -> AppResult<BookChapter> {
        let mut chapter = create_chapter(title, chapter_order);
        chapter.raw_html = Some(content.to_string());
        
        let mut current_element: Option<ContentElement> = None;
        let mut element_stack: Vec<ContentElement> = Vec::new();
        let mut text_buffer = String::new();
        
        let reader = xml::EventReader::from_str(content);
        
        for event in reader {
            match event.map_err(|e| AppError::ParseError(format!("XHTML parse error: {}", e)))? {
                xml::reader::XmlEvent::StartElement { name, attributes, .. } => {
                    if !text_buffer.trim().is_empty() {
                        if let Some(parent) = element_stack.last_mut() {
                            parent.children.push(create_element("text", text_buffer.trim()));
                        } else {
                            chapter.elements.push(create_element("text", text_buffer.trim()));
                        }
                        text_buffer.clear();
                    }
                    
                    let tag_name = name.local_name.clone();
                    let mut element = create_element(&tag_name, "");
                    
                    for attr in attributes {
                        element.attributes.insert(attr.name.local_name, attr.value);
                    }
                    
                    if let Some(current) = current_element.take() {
                        element_stack.push(current);
                    }
                    
                    current_element = Some(element);
                }
                xml::reader::XmlEvent::EndElement { name, .. } => {
                    if !text_buffer.trim().is_empty() {
                        if let Some(ref mut elem) = current_element {
                            elem.content = text_buffer.trim().to_string();
                        } else if let Some(parent) = element_stack.last_mut() {
                            parent.children.push(create_element("text", text_buffer.trim()));
                        } else {
                            chapter.elements.push(create_element("text", text_buffer.trim()));
                        }
                        text_buffer.clear();
                    }
                    
                    if let Some(elem) = current_element.take() {
                        if let Some(mut parent) = element_stack.pop() {
                            parent.children.push(elem);
                            current_element = Some(parent);
                        } else {
                            chapter.elements.push(elem);
                        }
                    }
                }
                xml::reader::XmlEvent::Characters(text) => {
                    text_buffer.push_str(&text);
                }
                _ => {}
            }
        }
        
        Ok(chapter)
    }
}

impl BookParser for EpubParser {
    fn can_parse(&self, format: &BookFormat) -> bool {
        matches!(format, BookFormat::Epub)
    }
    
    fn parse(&self, path: &PathBuf) -> AppResult<ParsedBook> {
        info!("Parsing EPUB: {:?}", path);
        
        let file = fs::File::open(path)?;
        let file_size = file.metadata()?.len();
        
        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| AppError::ParseError(format!("Failed to open EPUB archive: {}", e)))?;
        
        let mut opf_content = String::new();
        let mut opf_path = String::new();
        let mut chapters: Vec<BookChapter> = Vec::new();
        let mut css_styles: Vec<String> = Vec::new();
        let mut images: HashMap<String, Vec<u8>> = HashMap::new();
        let mut fonts: HashMap<String, Vec<u8>> = HashMap::new();
        
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)
                .map_err(|e| AppError::ParseError(format!("Failed to read archive entry: {}", e)))?;
            
            let name = file.name().to_string();
            
            if name.ends_with("META-INF/container.xml") {
                let mut content = String::new();
                file.read_to_string(&mut content)?;
                
                if let Some(pos) = content.find("full-path=\"") {
                    let rest = &content[pos + 11..];
                    if let Some(end_pos) = rest.find('"') {
                        opf_path = rest[..end_pos].to_string();
                    }
                }
            }
        }
        
        if !opf_path.is_empty() {
            if let Ok(mut opf_file) = archive.by_name(&opf_path) {
                opf_file.read_to_string(&mut opf_content)?;
            }
        }
        
        let (mut metadata, _manifest) = self.parse_opf(&opf_content)?;
        metadata.file_size = file_size;
        metadata.format = BookFormat::Epub;
        
        let mut chapter_order = 0;
        
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)
                .map_err(|e| AppError::ParseError(format!("Failed to read archive entry: {}", e)))?;
            
            let name = file.name().to_string();
            
            if (name.ends_with(".xhtml") || name.ends_with(".html") || name.ends_with(".htm")) && !name.starts_with("META-INF") {
                let mut content = String::new();
                file.read_to_string(&mut content)?;
                
                let title = name.split('/').last().unwrap_or(&name).to_string();
                match self.parse_xhtml(&content, chapter_order, &title) {
                    Ok(chapter) => {
                        chapters.push(chapter);
                        chapter_order += 1;
                    }
                    Err(e) => {
                        warn!("Failed to parse chapter {}: {}", name, e);
                    }
                }
            } else if name.ends_with(".css") {
                let mut content = String::new();
                file.read_to_string(&mut content)?;
                css_styles.push(content);
            } else if name.ends_with(".jpg") || name.ends_with(".jpeg") || name.ends_with(".png") || name.ends_with(".gif") {
                let mut buffer = Vec::new();
                file.read_to_end(&mut buffer)?;
                images.insert(name, buffer);
            } else if name.ends_with(".ttf") || name.ends_with(".otf") {
                let mut buffer = Vec::new();
                file.read_to_end(&mut buffer)?;
                fonts.insert(name, buffer);
            } else if name.ends_with("cover.jpeg") || name.ends_with("cover.jpg") || name.ends_with("cover.png") {
                let mut buffer = Vec::new();
                file.read_to_end(&mut buffer)?;
                metadata.cover_image = Some(buffer);
            }
        }
        
        chapters.sort_by_key(|c| c.order);
        
        debug!("Parsed {} chapters from EPUB", chapters.len());
        
        Ok(ParsedBook {
            metadata,
            chapters,
            css_styles,
            images,
            fonts,
            original_format: BookFormat::Epub,
            drm_removed: false,
            source_path: path.to_string_lossy().to_string(),
        })
    }
    
    fn parse_metadata(&self, path: &PathBuf) -> AppResult<BookMetadata> {
        let file = fs::File::open(path)?;
        let file_size = file.metadata()?.len();
        
        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| AppError::ParseError(format!("Failed to open EPUB archive: {}", e)))?;
        
        let mut opf_content = String::new();
        let mut opf_path = String::new();
        
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)
                .map_err(|e| AppError::ParseError(format!("Failed to read archive entry: {}", e)))?;
            
            let name = file.name().to_string();
            
            if name.ends_with("META-INF/container.xml") {
                let mut content = String::new();
                file.read_to_string(&mut content)?;
                
                if let Some(pos) = content.find("full-path=\"") {
                    let rest = &content[pos + 11..];
                    if let Some(end_pos) = rest.find('"') {
                        opf_path = rest[..end_pos].to_string();
                    }
                }
            }
        }
        
        if !opf_path.is_empty() {
            if let Ok(mut opf_file) = archive.by_name(&opf_path) {
                opf_file.read_to_string(&mut opf_content)?;
            }
        }
        
        let (mut metadata, _) = self.parse_opf(&opf_content)?;
        metadata.file_size = file_size;
        metadata.format = BookFormat::Epub;
        
        Ok(metadata)
    }
}

impl Default for EpubParser {
    fn default() -> Self {
        Self::new()
    }
}
