use std::fs;
use std::path::PathBuf;
use tracing::{info, debug, warn};
use crate::types::*;
use crate::AppResult;
use super::parser::{BookParser, create_element, create_chapter};

pub struct PdfParser;

impl PdfParser {
    pub fn new() -> Self {
        PdfParser
    }
    
    fn extract_text_from_pdf(&self, path: &PathBuf) -> AppResult<Vec<(u32, String)>> {
        use std::process::Command;
        
        let output = Command::new("pdftotext")
            .arg("-layout")
            .arg(path)
            .arg("-")
            .output()
            .map_err(|e| AppError::ExternalToolError(format!("pdftotext not available: {}", e)))?;
        
        if !output.status.success() {
            return Err(AppError::ExternalToolError(format!(
                "pdftotext failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )));
        }
        
        let content = String::from_utf8_lossy(&output.stdout).to_string();
        let mut pages: Vec<(u32, String)> = Vec::new();
        let mut current_page = 1;
        let mut current_text = String::new();
        
        for line in content.lines() {
            if line.contains("\x0c") {
                pages.push((current_page, current_text.clone()));
                current_page += 1;
                current_text.clear();
            } else {
                current_text.push_str(line);
                current_text.push('\n');
            }
        }
        
        if !current_text.is_empty() {
            pages.push((current_page, current_text));
        }
        
        if pages.is_empty() {
            pages.push((1, content));
        }
        
        Ok(pages)
    }
    
    fn parse_text_to_elements(&self, text: &str) -> Vec<ContentElement> {
        let mut elements = Vec::new();
        let mut current_paragraph = String::new();
        let mut current_formula = String::new();
        let mut in_formula_block = false;
        
        let all_lines: Vec<String> = text.lines().map(|s| s.to_string()).collect();
        
        let mut i = 0;
        while i < all_lines.len() {
            let line = &all_lines[i];
            let trimmed = line.trim();
            
            if trimmed.is_empty() {
                if in_formula_block && !current_formula.is_empty() {
                    elements.push(self.create_math_element(&current_formula));
                    current_formula.clear();
                    in_formula_block = false;
                } else if !current_paragraph.is_empty() {
                    elements.push(create_element("p", &current_paragraph));
                    current_paragraph.clear();
                }
                i += 1;
                continue;
            }
            
            if trimmed.starts_with("\\[") || trimmed.starts_with("\\begin{equation}") 
                || trimmed.starts_with("\\begin{align}") || trimmed.starts_with("$$") {
                if !current_paragraph.is_empty() {
                    elements.push(create_element("p", &current_paragraph));
                    current_paragraph.clear();
                }
                in_formula_block = true;
                current_formula.push_str(trimmed);
                i += 1;
                continue;
            }
            
            if in_formula_block {
                current_formula.push('\n');
                current_formula.push_str(trimmed);
                if trimmed.ends_with("\\]") || trimmed.ends_with("\\end{equation}") 
                    || trimmed.ends_with("\\end{align}") || trimmed.ends_with("$$") {
                    elements.push(self.create_math_element(&current_formula));
                    current_formula.clear();
                    in_formula_block = false;
                }
                i += 1;
                continue;
            }
            
            if self.is_math_formula(trimmed) {
                if !current_paragraph.is_empty() {
                    elements.push(create_element("p", &current_paragraph));
                    current_paragraph.clear();
                }
                
                let mut formula = trimmed.to_string();
                let mut j = i + 1;
                while j < all_lines.len() && j < i + 5 {
                    let next_line = &all_lines[j];
                    if next_line.trim().is_empty() {
                        break;
                    }
                    if self.is_math_formula(next_line.trim()) 
                        || (next_line.trim().starts_with(|c: char| c.is_ascii_alphanumeric() 
                            && next_line.trim().len() < 80
                            && (next_line.contains('=') || next_line.contains('+') || next_line.contains('-')))) {
                        formula.push('\n');
                        formula.push_str(next_line.trim());
                        j += 1;
                    } else {
                        break;
                    }
                }
                
                elements.push(self.create_math_element(&formula));
                i = j;
                continue;
            }
            
            if self.is_table_row(line, &all_lines, i) {
                if !current_paragraph.is_empty() {
                    elements.push(create_element("p", &current_paragraph));
                    current_paragraph.clear();
                }
                
                if let Some((end_idx, rows)) = self.detect_table(&all_lines, i) {
                    if rows.len() >= 2 {
                        debug!("Detected table with {} rows", rows.len());
                        elements.push(self.create_table_element(&rows));
                        i = end_idx;
                        continue;
                    }
                }
            }
            
            if self.is_heading(trimmed) {
                if !current_paragraph.is_empty() {
                    elements.push(create_element("p", &current_paragraph));
                    current_paragraph.clear();
                }
                
                let heading_level = self.get_heading_level(trimmed);
                elements.push(create_element(&format!("h{}", heading_level), trimmed));
            } else {
                if !current_paragraph.is_empty() {
                    current_paragraph.push(' ');
                }
                current_paragraph.push_str(trimmed);
            }
            
            i += 1;
        }
        
        if in_formula_block && !current_formula.is_empty() {
            elements.push(self.create_math_element(&current_formula));
        }
        
        if !current_paragraph.is_empty() {
            elements.push(create_element("p", &current_paragraph));
        }
        
        elements
    }
    
    fn is_heading(&self, text: &str) -> bool {
        let len = text.len();
        if len < 2 || len > 100 {
            return false;
        }
        
        if text.chars().all(|c| c.is_uppercase() || c.is_whitespace() || c.is_ascii_punctuation()) {
            return true;
        }
        
        if len < 50 && !text.ends_with('.') && !text.ends_with('。') {
            let has_lower = text.chars().any(|c| c.is_lowercase());
            let has_digit = text.chars().any(|c| c.is_ascii_digit());
            if !has_lower && has_digit {
                return true;
            }
        }
        
        false
    }
    
    fn get_heading_level(&self, text: &str) -> u32 {
        let len = text.len();
        if len < 20 { 2 } else if len < 40 { 3 } else { 4 }
    }
    
    fn is_math_formula(&self, line: &str) -> bool {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return false;
        }
        
        let math_symbols = ['∑', '∫', '∂', '∇', '∏', '√', '∞', '±', '≠', '≤', '≥', 
                           '→', '≈', '∝', '∈', '∉', '⊂', '⊃', '∩', '∪', '∅',
                           'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'λ', 'μ', 'π', 'σ', 'τ', 'φ', 'ω',
                           'Δ', 'Γ', 'Θ', 'Λ', 'Ξ', 'Π', 'Σ', 'Φ', 'Ψ', 'Ω'];
        
        let has_math_symbol = trimmed.chars().any(|c| math_symbols.contains(&c));
        if has_math_symbol {
            return true;
        }
        
        let latex_patterns = ["\\frac", "\\sqrt", "\\sum", "\\int", "\\lim", "\\prod", 
                             "\\alpha", "\\beta", "\\gamma", "\\theta", "\\pi", "\\lambda",
                             "\\begin{equation}", "\\begin{align}", "\\[", "\\]"];
        for pattern in &latex_patterns {
            if trimmed.contains(pattern) {
                return true;
            }
        }
        
        let equation_chars: Vec<char> = trimmed.chars().collect();
        let operator_count = equation_chars.iter().filter(|&&c| 
            c == '=' || c == '+' || c == '-' || c == '*' || c == '/' || c == '^' || c == '_'
        ).count();
        
        let number_count = equation_chars.iter().filter(|c| c.is_ascii_digit()).count();
        let letter_count = equation_chars.iter().filter(|c| c.is_ascii_alphabetic()).count();
        
        if operator_count >= 2 && number_count >= 2 && letter_count >= 2 {
            return true;
        }
        
        let single_letter_vars: Vec<_> = trimmed.split_whitespace()
            .filter(|s| s.len() == 1 && s.chars().next().map_or(false, |c| c.is_ascii_alphabetic()))
            .collect();
        if operator_count >= 1 && single_letter_vars.len() >= 2 {
            return true;
        }
        
        false
    }
    
    fn is_table_row(&self, line: &str, all_lines: &[String], current_idx: usize) -> bool {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return false;
        }
        
        if trimmed.contains(|c: char| c == '|' || c == '\t') {
            let separators: Vec<_> = trimmed.match_indices(|c: char| c == '|' || c == '\t').collect();
            if separators.len() >= 2 {
                return true;
            }
        }
        
        let multiple_spaces: Vec<_> = trimmed.match_indices("  ").collect();
        if multiple_spaces.len() >= 3 {
            let parts: Vec<_> = trimmed.split_whitespace().collect();
            if parts.len() >= 3 {
                let mut has_consistent_alignment = true;
                let positions: Vec<_> = trimmed.split_whitespace()
                    .map(|w| trimmed.find(w).unwrap_or(0))
                    .collect();
                
                if positions.len() >= 3 && current_idx + 2 < all_lines.len() {
                    for offset in 1..=2 {
                        if current_idx + offset < all_lines.len() {
                            let next_line = &all_lines[current_idx + offset];
                            let next_positions: Vec<_> = next_line.split_whitespace()
                                .map(|w| next_line.find(w).unwrap_or(0))
                                .collect();
                            
                            if next_positions.len() == positions.len() {
                                let mut diffs_similar = true;
                                for i in 1..positions.len() {
                                    let diff1 = positions[i] as isize - positions[i-1] as isize;
                                    let diff2 = next_positions[i] as isize - next_positions[i-1] as isize;
                                    if (diff1 - diff2).abs() > 5 {
                                        diffs_similar = false;
                                        break;
                                    }
                                }
                                if diffs_similar {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        let is_dashed = trimmed.chars().all(|c| c == '-' || c == '+' || c == '=' || c.is_whitespace());
        if is_dashed && trimmed.len() > 10 {
            return true;
        }
        
        false
    }
    
    fn detect_table(&self, lines: &[String], start_idx: usize) -> Option<(usize, Vec<Vec<String>>)> {
        let mut rows = Vec::new();
        let mut end_idx = start_idx;
        
        let mut current_row: Vec<String> = lines[start_idx]
            .split(|c: char| c == '|' || c == '\t' || c == '  ')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        
        if current_row.len() < 2 {
            return None;
        }
        
        let col_count = current_row.len();
        rows.push(current_row);
        end_idx += 1;
        
        while end_idx < lines.len() {
            let line = &lines[end_idx];
            let trimmed = line.trim();
            
            if trimmed.is_empty() {
                if rows.len() >= 2 {
                    break;
                }
                end_idx += 1;
                continue;
            }
            
            let is_dashed = trimmed.chars().all(|c| c == '-' || c == '+' || c == '=' || c.is_whitespace());
            if is_dashed {
                end_idx += 1;
                continue;
            }
            
            let row: Vec<String> = line
                .split(|c: char| c == '|' || c == '\t' || c == '  ')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            
            if row.len() >= 2 && (row.len() == col_count || (row.len() as isize - col_count as isize).abs() <= 1) {
                rows.push(row);
                end_idx += 1;
            } else {
                break;
            }
        }
        
        if rows.len() >= 2 {
            Some((end_idx, rows))
        } else {
            None
        }
    }
    
    fn create_table_element(&self, rows: &[Vec<String>]) -> ContentElement {
        let mut table_html = String::from("<table>");
        
        for (row_idx, row) in rows.iter().enumerate() {
            table_html.push_str("<tr>");
            for cell in row {
                let tag = if row_idx == 0 { "th" } else { "td" };
                table_html.push_str(&format!("<{}>{}</{}>", tag, cell, tag));
            }
            table_html.push_str("</tr>");
        }
        
        table_html.push_str("</table>");
        
        let mut elem = create_element("table", "");
        elem.raw_html = Some(table_html);
        elem
    }
    
    fn create_math_element(&self, formula: &str) -> ContentElement {
        let mut elem = create_element("div", formula);
        elem.element_type = "math".to_string();
        elem.attributes = HashMap::new();
        elem.attributes.insert("class".to_string(), "formula".to_string());
        elem
    }
    
    fn extract_pdf_metadata(&self, path: &PathBuf) -> AppResult<BookMetadata> {
        use std::process::Command;
        
        let mut metadata = BookMetadata::default();
        
        let output = Command::new("pdfinfo")
            .arg(path)
            .output()
            .map_err(|e| AppError::ExternalToolError(format!("pdfinfo not available: {}", e)))?;
        
        if output.status.success() {
            let info = String::from_utf8_lossy(&output.stdout);
            
            for line in info.lines() {
                if let Some((key, value)) = line.split_once(':') {
                    let value = value.trim().to_string();
                    match key.trim() {
                        "Title" => metadata.title = value,
                        "Author" => {
                            if !value.is_empty() {
                                metadata.authors = value.split(',').map(|s| s.trim().to_string()).collect();
                            }
                        }
                        "Producer" => metadata.publisher = Some(value),
                        "CreationDate" => metadata.publish_date = Some(value),
                        "Pages" => metadata.page_count = value.parse().ok(),
                        _ => {}
                    }
                }
            }
        }
        
        Ok(metadata)
    }
}

impl BookParser for PdfParser {
    fn can_parse(&self, format: &BookFormat) -> bool {
        matches!(format, BookFormat::Pdf)
    }
    
    fn parse(&self, path: &PathBuf) -> AppResult<ParsedBook> {
        info!("Parsing PDF: {:?}", path);
        
        let file_size = fs::metadata(path)?.len();
        let pages = self.extract_text_from_pdf(path)?;
        
        let mut file_metadata = self.extract_pdf_metadata(path)?;
        file_metadata.file_size = file_size;
        file_metadata.format = BookFormat::Pdf;
        file_metadata.page_count = Some(pages.len() as u32);
        
        if file_metadata.title.is_empty() {
            if let Some(filename) = path.file_stem().and_then(|f| f.to_str()) {
                file_metadata.title = filename.to_string();
            }
        }
        
        let mut chapters: Vec<BookChapter> = Vec::new();
        let mut current_chapter = create_chapter("正文", 0);
        let mut chapter_order = 0;
        let mut element_count = 0;
        
        for (page_num, page_text) in &pages {
            let elements = self.parse_text_to_elements(page_text);
            
            for element in elements {
                if element.element_type.starts_with('h') && element_count > 50 {
                    if !current_chapter.elements.is_empty() {
                        chapters.push(current_chapter);
                        chapter_order += 1;
                    }
                    current_chapter = create_chapter(&element.content, chapter_order);
                    element_count = 0;
                }
                
                current_chapter.elements.push(element);
                element_count += 1;
            }
        }
        
        if !current_chapter.elements.is_empty() {
            chapters.push(current_chapter);
        }
        
        if chapters.len() == 1 && chapters[0].elements.len() > 100 {
            chapters = self.split_into_chapters(chapters.remove(0));
        }
        
        debug!("Parsed {} chapters from PDF", chapters.len());
        
        Ok(ParsedBook {
            metadata: file_metadata,
            chapters,
            css_styles: Vec::new(),
            images: HashMap::new(),
            fonts: HashMap::new(),
            original_format: BookFormat::Pdf,
            drm_removed: false,
            source_path: path.to_string_lossy().to_string(),
        })
    }
    
    fn parse_metadata(&self, path: &PathBuf) -> AppResult<BookMetadata> {
        let file_size = fs::metadata(path)?.len();
        let mut metadata = self.extract_pdf_metadata(path)?;
        metadata.file_size = file_size;
        metadata.format = BookFormat::Pdf;
        
        if metadata.title.is_empty() {
            if let Some(filename) = path.file_stem().and_then(|f| f.to_str()) {
                metadata.title = filename.to_string();
            }
        }
        
        Ok(metadata)
    }
}

impl PdfParser {
    fn split_into_chapters(&self, chapter: BookChapter) -> Vec<BookChapter> {
        let mut chapters = Vec::new();
        let elements_per_chapter = 50;
        let mut current_chapter = create_chapter(&format!("第 {} 章", 1), 0);
        let mut chapter_num = 1;
        
        for (i, element) in chapter.elements.into_iter().enumerate() {
            if i > 0 && i % elements_per_chapter == 0 {
                chapters.push(current_chapter);
                chapter_num += 1;
                current_chapter = create_chapter(&format!("第 {} 章", chapter_num), chapter_num - 1);
            }
            current_chapter.elements.push(element);
        }
        
        if !current_chapter.elements.is_empty() {
            chapters.push(current_chapter);
        }
        
        chapters
    }
}

impl Default for PdfParser {
    fn default() -> Self {
        Self::new()
    }
}
