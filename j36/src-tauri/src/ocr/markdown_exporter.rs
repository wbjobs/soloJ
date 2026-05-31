use crate::types::*;
use crate::AppResult;
use std::path::PathBuf;

pub struct MarkdownExporter;

impl MarkdownExporter {
    pub fn new() -> Self {
        MarkdownExporter
    }

    pub fn export_to_markdown(&self, pages: &[OcrPageResult]) -> AppResult<String> {
        let mut markdown = String::new();
        
        for page in pages {
            for block in &page.layout_blocks {
                self.write_block(&mut markdown, block);
            }
            markdown.push_str("\n\n---\n\n");
        }
        
        Ok(markdown)
    }

    pub fn export_book_to_markdown(&self, book: &ParsedBook) -> AppResult<String> {
        let mut markdown = String::new();
        
        self.write_metadata(&mut markdown, &book.metadata);
        
        for chapter in &book.chapters {
            self.write_chapter(&mut markdown, chapter);
        }
        
        Ok(markdown)
    }

    pub fn save_markdown(&self, content: &str, output_path: &PathBuf) -> AppResult<()> {
        std::fs::write(output_path, content)?;
        Ok(())
    }

    fn write_metadata(&self, markdown: &mut String, metadata: &BookMetadata) {
        markdown.push_str(&format!("# {}\n\n", metadata.title));
        
        if !metadata.authors.is_empty() {
            markdown.push_str(&format!("**作者**: {}\n\n", metadata.authors.join(", ")));
        }
        
        if let Some(publisher) = &metadata.publisher {
            markdown.push_str(&format!("**出版社**: {}\n\n", publisher));
        }
        
        if let Some(date) = &metadata.publish_date {
            markdown.push_str(&format!("**出版日期**: {}\n\n", date));
        }
        
        if let Some(isbn) = &metadata.isbn {
            markdown.push_str(&format!("**ISBN**: {}\n\n", isbn));
        }
        
        if !metadata.tags.is_empty() {
            markdown.push_str(&format!("**标签**: {}\n\n", metadata.tags.join(", ")));
        }
        
        if let Some(desc) = &metadata.description {
            markdown.push_str(&format!("{}\n\n", desc));
        }
        
        markdown.push_str("---\n\n");
    }

    fn write_chapter(&self, markdown: &mut String, chapter: &BookChapter) {
        markdown.push_str(&format!("# {}\n\n", chapter.title));
        
        for element in &chapter.elements {
            self.write_element(markdown, element);
        }
        
        markdown.push_str("\n\n");
    }

    fn write_element(&self, markdown: &mut String, element: &ContentElement) {
        match element.element_type.as_str() {
            "h1" | "title" => {
                markdown.push_str(&format!("# {}\n\n", element.content));
            }
            "h2" => {
                markdown.push_str(&format!("## {}\n\n", element.content));
            }
            "h3" => {
                markdown.push_str(&format!("### {}\n\n", element.content));
            }
            "h4" => {
                markdown.push_str(&format!("#### {}\n\n", element.content));
            }
            "p" | "paragraph" => {
                markdown.push_str(&format!("{}\n\n", element.content));
            }
            "li" | "list-item" => {
                markdown.push_str(&format!("- {}\n", element.content));
            }
            "table" => {
                self.write_html_table(markdown, element);
            }
            "tr" => {
                markdown.push_str(&format!("| {} |\n", element.content.replace("|", " | ")));
            }
            "math" | "formula" => {
                markdown.push_str(&format!("$$\n{}\n$$\n\n", element.content));
            }
            "blockquote" | "quote" => {
                for line in element.content.lines() {
                    markdown.push_str(&format!("> {}\n", line));
                }
                markdown.push('\n');
            }
            "code" | "pre" => {
                markdown.push_str("```\n");
                markdown.push_str(&element.content);
                markdown.push_str("\n```\n\n");
            }
            _ => {
                if !element.children.is_empty() {
                    for child in &element.children {
                        self.write_element(markdown, child);
                    }
                } else if !element.content.is_empty() {
                    markdown.push_str(&format!("{}\n\n", element.content));
                }
            }
        }
    }

    fn write_block(&self, markdown: &mut String, block: &LayoutBlock) {
        match block.block_type {
            LayoutBlockType::Title => {
                markdown.push_str(&format!("# {}\n\n", block.text));
            }
            LayoutBlockType::Heading1 => {
                markdown.push_str(&format!("# {}\n\n", block.text));
            }
            LayoutBlockType::Heading2 => {
                markdown.push_str(&format!("## {}\n\n", block.text));
            }
            LayoutBlockType::Heading3 => {
                markdown.push_str(&format!("### {}\n\n", block.text));
            }
            LayoutBlockType::Paragraph => {
                markdown.push_str(&format!("{}\n\n", block.text));
            }
            LayoutBlockType::ListItem => {
                markdown.push_str(&format!("- {}\n", block.text.trim_start_matches(&['-', '•', '*', ' ', '●', '○'][..])));
            }
            LayoutBlockType::List => {
                markdown.push_str(&format!("{}\n\n", block.text));
            }
            LayoutBlockType::Table => {
                self.write_table_from_text(markdown, &block.text);
            }
            LayoutBlockType::TableRow => {
                self.write_table_row(markdown, &block.text);
            }
            LayoutBlockType::TableCell => {
                markdown.push_str(&format!("| {} ", block.text));
            }
            LayoutBlockType::Footnote => {
                markdown.push_str(&format!("[^{}]: {}\n\n", block.order, block.text));
            }
            LayoutBlockType::Image => {
                markdown.push_str(&format!("![Image]({})\n\n", block.text));
            }
            LayoutBlockType::Unknown => {
                markdown.push_str(&format!("{}\n\n", block.text));
            }
        }
    }

    fn write_table_from_text(&self, markdown: &mut String, table_text: &str) {
        let lines: Vec<&str> = table_text.lines().collect();
        let mut is_first_data_row = true;
        
        for line in lines {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            
            let is_separator = trimmed.contains('+') && trimmed.matches('-').count() > 4;
            
            if is_separator {
                let cells: Vec<&str> = trimmed.split(&['+', '|'][..]).filter(|s| !s.is_empty()).collect();
                markdown.push_str("| ");
                markdown.push_str(&vec!["---"; cells.len()].join(" | "));
                markdown.push_str(" |\n");
                is_first_data_row = false;
            } else {
                let cells: Vec<&str> = trimmed.split('|').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
                if !cells.is_empty() {
                    markdown.push_str("| ");
                    markdown.push_str(&cells.join(" | "));
                    markdown.push_str(" |\n");
                    
                    if is_first_data_row && !trimmed.contains(&['+', '-'][..]) {
                        markdown.push_str("| ");
                        markdown.push_str(&vec!["---"; cells.len()].join(" | "));
                        markdown.push_str(" |\n");
                        is_first_data_row = false;
                    }
                }
            }
        }
        
        markdown.push('\n');
    }

    fn write_table_row(&self, markdown: &mut String, text: &str) {
        let cells: Vec<&str> = text.split('|').map(|s| s.trim()).collect();
        let filtered: Vec<&str> = cells.into_iter().filter(|s| !s.is_empty()).collect();
        
        if !filtered.is_empty() {
            markdown.push_str("| ");
            markdown.push_str(&filtered.join(" | "));
            markdown.push_str(" |\n");
            
            if markdown.lines().filter(|l| l.starts_with('|') && l.contains("---")).count() == 0 
               && markdown.lines().filter(|l| l.starts_with('|')).count() == 1 {
                markdown.push_str("| ");
                markdown.push_str(&vec!["---"; filtered.len()].join(" | "));
                markdown.push_str(" |\n");
            }
        }
    }

    fn write_html_table(&self, markdown: &mut String, element: &ContentElement) {
        if let Some(html) = &element.raw_html {
            markdown.push_str(&format!("<div>\n{}\n</div>\n\n", html));
        } else {
            markdown.push_str(&format!("{}\n\n", element.content));
        }
    }
}
