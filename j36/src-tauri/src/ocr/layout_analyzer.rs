use crate::types::*;

pub struct LayoutAnalyzer {
    enable_table_detection: bool,
}

impl LayoutAnalyzer {
    pub fn new(enable_table_detection: bool) -> Self {
        LayoutAnalyzer {
            enable_table_detection,
        }
    }

    pub fn analyze(&self, text: &str) -> Vec<LayoutBlock> {
        let mut blocks = Vec::new();
        let mut order = 0u32;
        let lines: Vec<&str> = text.lines().collect();
        
        let mut i = 0;
        while i < lines.len() {
            let line = lines[i].trim();
            
            if line.is_empty() {
                i += 1;
                continue;
            }
            
            if self.enable_table_detection {
                if let Some((table_block, consumed)) = self.detect_table(&lines, i) {
                    blocks.push(table_block);
                    i += consumed;
                    continue;
                }
            }
            
            let block = self.classify_line(line, i, order);
            blocks.push(block);
            order += 1;
            i += 1;
        }
        
        blocks
    }

    fn detect_table(&self, lines: &[&str], start_idx: usize) -> Option<(LayoutBlock, usize)> {
        let mut table_lines = Vec::new();
        let mut i = start_idx;
        
        while i < lines.len() {
            let line = lines[i].trim();
            
            if line.is_empty() {
                if table_lines.len() >= 2 {
                    break;
                }
                i += 1;
                continue;
            }
            
            let pipe_count = line.matches('|').count();
            let plus_count = line.matches('+').count();
            let dash_count = line.matches('-').count();
            
            let is_table_separator = (plus_count >= 2 && dash_count >= 4)
                || (pipe_count >= 2 && dash_count >= line.len() / 2);
            
            let is_table_row = pipe_count >= 2 || is_table_separator;
            
            if is_table_row || is_table_separator {
                table_lines.push(line);
                i += 1;
            } else if !table_lines.is_empty() {
                break;
            } else {
                return None;
            }
        }
        
        if table_lines.len() >= 2 {
            let table_text = table_lines.join("\n");
            Some((
                LayoutBlock {
                    block_type: LayoutBlockType::Table,
                    text: table_text,
                    bounding_box: (0, 0, 0, 0),
                    confidence: 0.85,
                    order: start_idx as u32,
                    level: 5,
                },
                i - start_idx,
            ))
        } else {
            None
        }
    }

    fn classify_line(&self, line: &str, line_num: usize, order: u32) -> LayoutBlock {
        let trimmed = line.trim();
        
        if line_num == 0 && trimmed.len() < 100 && !trimmed.contains(|c: char| c.is_ascii_punctuation() && c != '.') {
            return LayoutBlock {
                block_type: LayoutBlockType::Title,
                text: trimmed.to_string(),
                bounding_box: (0, 0, 0, 0),
                confidence: 0.9,
                order,
                level: 1,
            };
        }

        let heading_patterns = [
            ("第", "章", LayoutBlockType::Heading1),
            ("第", "节", LayoutBlockType::Heading2),
            ("§", "", LayoutBlockType::Heading2),
        ];

        for (prefix, suffix, block_type) in heading_patterns {
            if trimmed.starts_with(prefix) && (suffix.is_empty() || trimmed.contains(suffix)) {
                let level = match block_type {
                    LayoutBlockType::Heading1 => 2,
                    LayoutBlockType::Heading2 => 3,
                    LayoutBlockType::Heading3 => 4,
                    _ => 5,
                };
                return LayoutBlock {
                    block_type,
                    text: trimmed.to_string(),
                    bounding_box: (0, 0, 0, 0),
                    confidence: 0.85,
                    order,
                    level,
                };
            }
        }

        if self.is_numbered_heading(trimmed) {
            return LayoutBlock {
                block_type: LayoutBlockType::Heading2,
                text: trimmed.to_string(),
                bounding_box: (0, 0, 0, 0),
                confidence: 0.8,
                order,
                level: 3,
            };
        }

        if self.is_list_item(trimmed) {
            return LayoutBlock {
                block_type: LayoutBlockType::ListItem,
                text: trimmed.to_string(),
                bounding_box: (0, 0, 0, 0),
                confidence: 0.85,
                order,
                level: 6,
            };
        }

        if self.is_footnote(trimmed) {
            return LayoutBlock {
                block_type: LayoutBlockType::Footnote,
                text: trimmed.to_string(),
                bounding_box: (0, 0, 0, 0),
                confidence: 0.8,
                order,
                level: 7,
            };
        }

        LayoutBlock {
            block_type: LayoutBlockType::Paragraph,
            text: trimmed.to_string(),
            bounding_box: (0, 0, 0, 0),
            confidence: 0.9,
            order,
            level: 5,
        }
    }

    fn is_numbered_heading(&self, line: &str) -> bool {
        if line.len() < 3 {
            return false;
        }
        
        let patterns = [
            |c: char| c.is_ascii_digit(),
            |c: char| c == '①' || c == '②' || c == '③' || c == '④' || c == '⑤',
            |c: char| c == 'Ⅰ' || c == 'Ⅱ' || c == 'Ⅲ' || c == 'Ⅳ' || c == 'Ⅴ',
        ];
        
        for pattern in patterns {
            if line.chars().next().map_or(false, pattern) {
                if line.chars().nth(1) == Some('.') || line.chars().nth(1) == Some('、') {
                    return true;
                }
            }
        }
        
        false
    }

    fn is_list_item(&self, line: &str) -> bool {
        let markers = ['-', '•', '●', '○', '▪', '▫', '*'];
        line.chars().next().map_or(false, |c| markers.contains(&c))
    }

    fn is_footnote(&self, line: &str) -> bool {
        (line.starts_with('[') && line.contains(']')) 
            || (line.starts_with('注') && line.contains('：'))
            || line.starts_with('脚注')
    }
}
