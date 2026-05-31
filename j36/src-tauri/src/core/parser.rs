use std::path::PathBuf;
use std::collections::HashMap;
use uuid::Uuid;
use crate::types::*;
use crate::AppResult;

pub trait BookParser {
    fn can_parse(&self, format: &BookFormat) -> bool;
    fn parse(&self, path: &PathBuf) -> AppResult<ParsedBook>;
    fn parse_metadata(&self, path: &PathBuf) -> AppResult<BookMetadata>;
}

pub struct ParserRegistry {
    parsers: Vec<Box<dyn BookParser + Send + Sync>>,
}

impl ParserRegistry {
    pub fn new() -> Self {
        let mut registry = ParserRegistry {
            parsers: Vec::new(),
        };
        
        registry.register(Box::new(super::epub_parser::EpubParser::new()));
        registry.register(Box::new(super::pdf_parser::PdfParser::new()));
        registry.register(Box::new(super::azw_parser::AzwParser::new()));
        
        registry
    }
    
    pub fn register(&mut self, parser: Box<dyn BookParser + Send + Sync>) {
        self.parsers.push(parser);
    }
    
    pub fn get_parser(&self, format: &BookFormat) -> Option<&dyn BookParser> {
        self.parsers.iter().find(|p| p.can_parse(format)).map(|p| p.as_ref())
    }
    
    pub fn parse_book(&self, path: &PathBuf) -> AppResult<ParsedBook> {
        let format = BookFormat::from_path(path);
        
        match self.get_parser(&format) {
            Some(parser) => parser.parse(path),
            None => Err(AppError::UnsupportedFormat(format)),
        }
    }
    
    pub fn parse_metadata(&self, path: &PathBuf) -> AppResult<BookMetadata> {
        let format = BookFormat::from_path(path);
        
        match self.get_parser(&format) {
            Some(parser) => parser.parse_metadata(path),
            None => Err(AppError::UnsupportedFormat(format)),
        }
    }
}

impl Default for ParserRegistry {
    fn default() -> Self {
        Self::new()
    }
}

pub fn generate_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn extract_text_from_elements(elements: &[ContentElement]) -> String {
    let mut text = String::new();
    
    for element in elements {
        text.push_str(&element.content);
        text.push('\n');
        
        if !element.children.is_empty() {
            text.push_str(&extract_text_from_elements(&element.children));
        }
    }
    
    text
}

pub fn collect_searchable_text(book: &ParsedBook) -> String {
    let mut text = String::new();
    
    text.push_str(&book.metadata.title);
    text.push('\n');
    
    for author in &book.metadata.authors {
        text.push_str(author);
        text.push('\n');
    }
    
    if let Some(desc) = &book.metadata.description {
        text.push_str(desc);
        text.push('\n');
    }
    
    for chapter in &book.chapters {
        text.push_str(&chapter.title);
        text.push('\n');
        text.push_str(&extract_text_from_elements(&chapter.elements));
    }
    
    text
}

pub fn build_chapter_navigation(book: &RearrangedBook) -> Vec<(String, String)> {
    book.chapter_navigation.clone()
}

pub fn create_element(element_type: &str, content: &str) -> ContentElement {
    ContentElement {
        id: generate_id(),
        element_type: element_type.to_string(),
        content: content.to_string(),
        style: None,
        attributes: HashMap::new(),
        children: Vec::new(),
        raw_html: None,
    }
}

pub fn create_chapter(title: &str, order: u32) -> BookChapter {
    BookChapter {
        id: generate_id(),
        title: title.to_string(),
        order,
        elements: Vec::new(),
        raw_html: None,
    }
}
