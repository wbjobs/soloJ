use std::fs;
use std::path::PathBuf;
use tracing::{info, debug, warn, error};
use crate::types::*;
use crate::AppResult;
use super::parser::{BookParser, create_element, create_chapter};

pub struct AzwParser;

impl AzwParser {
    pub fn new() -> Self {
        AzwParser
    }
    
    fn check_drm(&self, path: &PathBuf) -> AppResult<DrmInfo> {
        let file = fs::File::open(path)?;
        let mut reader = std::io::BufReader::new(file);
        
        let mut header = [0u8; 78];
        use std::io::Read;
        reader.read_exact(&mut header)?;
        
        let identifier = &header[0..4];
        let mut is_protected = false;
        let mut drm_type: Option<String> = None;
        let mut can_remove = true;
        
        if identifier == b"BOOK" || identifier == b"TEXT" {
            let drm_offset = 28;
            let drm_bytes = &header[drm_offset..drm_offset + 4];
            let drm_flag = u32::from_be_bytes([drm_bytes[0], drm_bytes[1], drm_bytes[2], drm_bytes[3]]);
            
            if drm_flag != 0 {
                is_protected = true;
                drm_type = Some("Amazon DRM".to_string());
            }
            
            let drm_count = u16::from_be_bytes([header[72], header[73]]);
            if drm_count > 0 {
                is_protected = true;
                drm_type = Some(format!("Amazon DRM ({} key(s) needed)", drm_count));
                can_remove = drm_count <= 2;
            }
        }
        
        Ok(DrmInfo {
            drm_type,
            is_protected,
            can_remove,
            required_tools: vec!["calibre".to_string(), "DeDRM_plugin".to_string()],
        })
    }
    
    fn detect_image_records(&self, data: &[u8]) -> Vec<(u32, u32, String)> {
        let mut images = Vec::new();
        let mut pos = 78usize;
        
        while pos + 8 < data.len() {
            let record_type = u32::from_be_bytes([data[pos], data[pos+1], data[pos+2], data[pos+3]]);
            let record_size = u32::from_be_bytes([data[pos+4], data[pos+5], data[pos+6], data[pos+7]]);
            
            if record_size < 8 {
                pos += 8;
                continue;
            }
            
            match record_type {
                5 | 6 | 10 => {
                    let data_start = pos + 8;
                    let data_end = data_start + (record_size as usize) - 8;
                    
                    if data_end <= data.len() {
                        let record_data = &data[data_start..data_end];
                        
                        let mime_type = if record_data.len() > 3 && &record_data[0..3] == b"\xFF\xD8\xFF" {
                            "image/jpeg".to_string()
                        } else if record_data.len() > 8 && &record_data[0..8] == b"\x89PNG\r\n\x1a\n" {
                            "image/png".to_string()
                        } else if record_data.len() > 3 && &record_data[0..3] == b"GIF" {
                            "image/gif".to_string()
                        } else {
                            continue;
                        };
                        
                        images.push((data_start as u32, (data_end - data_start) as u32, mime_type));
                    }
                },
                _ => {}
            }
            
            pos += record_size as usize;
            if record_size == 0 {
                break;
            }
        }
        
        images
    }
    
    fn try_extract_images(&self, data: &[u8]) -> HashMap<String, Vec<u8>> {
        let mut images = HashMap::new();
        
        let image_records = self.detect_image_records(data);
        
        for (i, (offset, length, mime_type)) in image_records.iter().enumerate() {
            let start = *offset as usize;
            let end = start + *length as usize;
            
            if end <= data.len() {
                let image_data = &data[start..end];
                
                let first_bytes = if image_data.len() > 4 {
                    &image_data[0..4]
                } else {
                    image_data
                };
                
                let is_encrypted = first_bytes.iter().all(|&b| b == 0) || 
                    (first_bytes.len() > 2 && first_bytes[0] == 0x00 && first_bytes[1] == 0x00 && first_bytes[2] == 0x00);
                
                if is_encrypted {
                    warn!("Image record {} appears encrypted, skipping", i);
                    continue;
                }
                
                let image_id = format!("img_{:04}", i);
                debug!("Extracted image {}: {} bytes, {}", image_id, length, mime_type);
                images.insert(image_id, image_data.to_vec());
            }
        }
        
        images
    }
    
    fn safe_extract_text(&self, data: &[u8], offset: u32, length: u32) -> AppResult<String> {
        let start = offset as usize;
        let end = (offset + length) as usize;
        
        if end > data.len() {
            warn!("Text offset/length out of bounds: offset={}, length={}, data_len={}", 
                  offset, length, data.len());
            let adjusted_end = data.len().min(end);
            if adjusted_end <= start {
                return Err(AppError::ParseError("Text offset/length invalid".to_string()));
            }
            return self.extract_text(data, offset, (adjusted_end - start) as u32);
        }
        
        self.extract_text(data, offset, length)
    }
    
    fn parse_mobi_header(&self, data: &[u8]) -> AppResult<(BookMetadata, u32, u32)> {
        let mut metadata = BookMetadata::default();
        
        if data.len() < 78 {
            return Err(AppError::ParseError("AZW file too short".to_string()));
        }
        
        let identifier = &data[0..4];
        if identifier != b"BOOK" && identifier != b"TEXT" {
            warn!("Unknown AZW identifier: {:?}", identifier);
        }
        
        let text_length = u32::from_be_bytes([data[4], data[5], data[6], data[7]]);
        let text_offset = u32::from_be_bytes([data[16], data[17], data[18], data[19]]);
        
        if data.len() >= 116 {
            let exth_flags = u32::from_be_bytes([data[112], data[113], data[114], data[115]]);
            
            if (exth_flags & 0x40) != 0 && data.len() > 116 {
                let exth_offset = 78 + text_length as usize;
                if exth_offset + 12 < data.len() {
                    let exth_identifier = &data[exth_offset..exth_offset + 4];
                    if exth_identifier == b"EXTH" {
                        let record_count = u32::from_be_bytes([
                            data[exth_offset + 8], data[exth_offset + 9],
                            data[exth_offset + 10], data[exth_offset + 11]
                        ]);
                        
                        let mut pos = exth_offset + 12;
                        for _ in 0..record_count {
                            if pos + 8 >= data.len() {
                                break;
                            }
                            
                            let record_type = u32::from_be_bytes([
                                data[pos], data[pos + 1], data[pos + 2], data[pos + 3]
                            ]);
                            let record_length = u32::from_be_bytes([
                                data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]
                            ]) as usize;
                            
                            if record_length < 8 {
                                pos += 8;
                                continue;
                            }
                            
                            let data_start = pos + 8;
                            let data_end = pos + record_length;
                            
                            if data_end <= data.len() {
                                let record_data = &data[data_start..data_end];
                                
                                match record_type {
                                    100 => metadata.authors.push(String::from_utf8_lossy(record_data).trim().to_string()),
                                    101 => metadata.publisher = Some(String::from_utf8_lossy(record_data).trim().to_string()),
                                    106 => metadata.publish_date = Some(String::from_utf8_lossy(record_data).trim().to_string()),
                                    105 => metadata.description = Some(String::from_utf8_lossy(record_data).trim().to_string()),
                                    109 => metadata.language = Some(String::from_utf8_lossy(record_data).trim().to_string()),
                                    112 => metadata.tags.push(String::from_utf8_lossy(record_data).trim().to_string()),
                                    _ => {}
                                }
                            }
                            
                            pos += record_length;
                        }
                    }
                }
            }
        }
        
        metadata.format = BookFormat::Azw3;
        
        Ok((metadata, text_offset, text_length))
    }
    
    fn extract_text(&self, data: &[u8], offset: u32, length: u32) -> AppResult<String> {
        let start = offset as usize;
        let end = (offset + length) as usize;
        
        if end > data.len() {
            return Err(AppError::ParseError("Text offset/length out of bounds".to_string()));
        }
        
        let text_data = &data[start..end];
        let mut text = String::new();
        
        let mut i = 0;
        while i < text_data.len() {
            let byte = text_data[i];
            
            if byte == 0x00 {
                text.push(' ');
                i += 1;
            } else if byte == 0x0A || byte == 0x0D {
                text.push('\n');
                i += 1;
            } else if byte & 0x80 == 0 {
                text.push(byte as char);
                i += 1;
            } else if byte & 0xE0 == 0xC0 && i + 1 < text_data.len() {
                let c = ((byte as u32 & 0x1F) << 6) | (text_data[i + 1] as u32 & 0x3F);
                if let Some(ch) = char::from_u32(c) {
                    text.push(ch);
                }
                i += 2;
            } else if byte & 0xF0 == 0xE0 && i + 2 < text_data.len() {
                let c = ((byte as u32 & 0x0F) << 12) 
                    | ((text_data[i + 1] as u32 & 0x3F) << 6) 
                    | (text_data[i + 2] as u32 & 0x3F);
                if let Some(ch) = char::from_u32(c) {
                    text.push(ch);
                }
                i += 3;
            } else {
                text.push(char::REPLACEMENT_CHARACTER);
                i += 1;
            }
        }
        
        Ok(text)
    }
    
    fn parse_text_to_chapters(&self, text: &str) -> Vec<BookChapter> {
        let mut chapters = Vec::new();
        let mut current_chapter = create_chapter("正文", 0);
        let mut chapter_order = 0;
        let mut current_paragraph = String::new();
        
        let chapter_patterns = [
            "第[一二三四五六七八九十百千0-9]+章",
            "Chapter\\s+\\d+",
            "CHAPTER\\s+\\d+",
        ];
        
        let regex = regex::Regex::new(&chapter_patterns.join("|")).ok();
        
        for line in text.lines() {
            let trimmed = line.trim();
            
            if trimmed.is_empty() {
                if !current_paragraph.is_empty() {
                    current_chapter.elements.push(create_element("p", &current_paragraph));
                    current_paragraph.clear();
                }
                continue;
            }
            
            let is_chapter_header = if let Some(ref re) = regex {
                re.is_match(trimmed)
            } else {
                false
            };
            
            if is_chapter_header && (current_chapter.elements.len() > 10 || chapters.is_empty()) {
                if !current_paragraph.is_empty() {
                    current_chapter.elements.push(create_element("p", &current_paragraph));
                    current_paragraph.clear();
                }
                
                if !current_chapter.elements.is_empty() {
                    chapters.push(current_chapter);
                    chapter_order += 1;
                }
                
                current_chapter = create_chapter(trimmed, chapter_order);
                current_chapter.elements.push(create_element("h2", trimmed));
            } else if trimmed.len() < 50 
                && !trimmed.ends_with('.') 
                && !trimmed.ends_with('。')
                && current_chapter.elements.len() > 20
                && !trimmed.contains(|c: char| c.is_lowercase()) {
                
                if !current_paragraph.is_empty() {
                    current_chapter.elements.push(create_element("p", &current_paragraph));
                    current_paragraph.clear();
                }
                
                if !current_chapter.elements.is_empty() {
                    chapters.push(current_chapter);
                    chapter_order += 1;
                }
                
                current_chapter = create_chapter(trimmed, chapter_order);
                current_chapter.elements.push(create_element("h3", trimmed));
            } else {
                if !current_paragraph.is_empty() {
                    current_paragraph.push(' ');
                }
                current_paragraph.push_str(trimmed);
                
                if current_paragraph.len() > 500 || trimmed.ends_with('.') || trimmed.ends_with('。') {
                    current_chapter.elements.push(create_element("p", &current_paragraph));
                    current_paragraph.clear();
                }
            }
        }
        
        if !current_paragraph.is_empty() {
            current_chapter.elements.push(create_element("p", &current_paragraph));
        }
        
        if !current_chapter.elements.is_empty() {
            chapters.push(current_chapter);
        }
        
        chapters
    }
}

impl BookParser for AzwParser {
    fn can_parse(&self, format: &BookFormat) -> bool {
        matches!(format, BookFormat::Azw3 | BookFormat::Mobi)
    }
    
    fn parse(&self, path: &PathBuf) -> AppResult<ParsedBook> {
        info!("Parsing AZW/MOBI: {:?}", path);
        
        let data = fs::read(path)?;
        let file_size = data.len() as u64;
        
        let drm_info = self.check_drm(path)?;
        
        let mut images = HashMap::new();
        let mut partial_parse = false;
        
        if drm_info.is_protected {
            warn!("AZW file has DRM protection, attempting partial extraction");
            
            match self.try_extract_images(&data) {
                imgs if !imgs.is_empty() => {
                    images = imgs;
                    info!("Successfully extracted {} unencrypted images", images.len());
                },
                _ => {
                    warn!("Could not extract images - likely encrypted (no key found)");
                }
            }
            
            partial_parse = true;
        }
        
        let (mut metadata, text_offset, text_length) = match self.parse_mobi_header(&data) {
            Ok(result) => result,
            Err(e) => {
                error!("Failed to parse MOBI header: {}", e);
                if drm_info.is_protected {
                    return Err(AppError::DrmError(format!(
                        "File is DRM protected and header parsing failed. Please remove DRM first. Error: {}",
                        e
                    )));
                }
                return Err(e);
            }
        };
        
        metadata.file_size = file_size;
        metadata.drm_protected = Some(drm_info.is_protected);
        
        if metadata.title.is_empty() {
            if let Some(filename) = path.file_stem().and_then(|f| f.to_str()) {
                metadata.title = filename.to_string();
            }
        }
        
        if !drm_info.is_protected && images.is_empty() {
            images = self.try_extract_images(&data);
        }
        
        let text = match self.safe_extract_text(&data, text_offset, text_length) {
            Ok(t) => t,
            Err(e) => {
                if drm_info.is_protected {
                    return Err(AppError::DrmError(format!(
                        "Text extraction failed - file is DRM protected (no key found). Please remove DRM first using the DRM removal module. Error: {}",
                        e
                    )));
                }
                return Err(e);
            }
        };
        
        let chapters = if !text.is_empty() {
            self.parse_text_to_chapters(&text)
        } else {
            warn!("Text is empty - book may be encrypted");
            let mut ch = create_chapter("内容", 0);
            ch.elements.push(create_element("p", 
                if drm_info.is_protected {
                    "此书受DRM保护，无法直接阅读。请先使用DRM移除功能。"
                } else {
                    "无法提取文本内容。"
                }
            ));
            vec![ch]
        };
        
        debug!("Parsed {} chapters from AZW{}", chapters.len(), 
               if partial_parse { " (partial due to DRM)" } else { "" });
        
        if partial_parse && chapters.len() == 1 && images.is_empty() {
            return Err(AppError::DrmError(
                "File is DRM protected. Please remove DRM first using the DRM removal module.".to_string()
            ));
        }
        
        Ok(ParsedBook {
            metadata,
            chapters,
            css_styles: Vec::new(),
            images,
            fonts: HashMap::new(),
            original_format: BookFormat::Azw3,
            drm_removed: false,
            source_path: path.to_string_lossy().to_string(),
        })
    }
    
    fn parse_metadata(&self, path: &PathBuf) -> AppResult<BookMetadata> {
        let data = fs::read(path)?;
        let file_size = data.len() as u64;
        
        let (mut metadata, _, _) = self.parse_mobi_header(&data)?;
        metadata.file_size = file_size;
        
        if metadata.title.is_empty() {
            if let Some(filename) = path.file_stem().and_then(|f| f.to_str()) {
                metadata.title = filename.to_string();
            }
        }
        
        Ok(metadata)
    }
}

impl Default for AzwParser {
    fn default() -> Self {
        Self::new()
    }
}
