use jieba_rs::Jieba;
use lazy_static::lazy_static;
use std::sync::Mutex;

lazy_static! {
    static ref JIEBA: Mutex<Jieba> = Mutex::new(Jieba::new());
}

pub struct ChineseTokenizer;

impl ChineseTokenizer {
    pub fn new() -> Self {
        ChineseTokenizer
    }

    pub fn tokenize(&self, text: &str, for_search: bool) -> Vec<String> {
        let jieba = JIEBA.lock().unwrap();
        
        let tokens = if for_search {
            jieba.cut_for_search(text, true)
        } else {
            jieba.cut(text, true)
        };
        
        let mut result: Vec<String> = tokens
            .into_iter()
            .filter(|t| !t.trim().is_empty())
            .filter(|t| t.chars().count() > 0)
            .map(|t| t.to_string())
            .collect();
        
        if for_search {
            let ngrams = self.generate_ngrams(text, 2);
            for gram in ngrams {
                if !result.contains(&gram) {
                    result.push(gram);
                }
            }
            
            let trigrams = self.generate_ngrams(text, 3);
            for gram in trigrams {
                if !result.contains(&gram) {
                    result.push(gram);
                }
            }
        }
        
        result
    }

    pub fn tokenize_for_index(&self, text: &str) -> Vec<String> {
        let jieba = JIEBA.lock().unwrap();
        let tokens = jieba.cut(text, true);
        
        let mut result: Vec<String> = tokens
            .into_iter()
            .filter(|t| !t.trim().is_empty())
            .filter(|t| t.chars().count() > 0)
            .map(|t| t.to_string())
            .collect();
        
        let bigrams = self.generate_ngrams(text, 2);
        result.extend(bigrams);
        
        let trigrams = self.generate_ngrams(text, 3);
        result.extend(trigrams);
        
        result
    }

    pub fn tokenize_for_search_fallback(&self, text: &str) -> Vec<String> {
        let mut tokens = self.tokenize(text, true);
        
        if tokens.len() <= 3 {
            let bigrams = self.generate_ngrams(text, 2);
            for gram in bigrams {
                if !tokens.contains(&gram) {
                    tokens.push(gram);
                }
            }
            
            let single_chars: Vec<String> = text
                .chars()
                .filter(|c| is_chinese(*c) || c.is_ascii_alphanumeric())
                .map(|c| c.to_string())
                .collect();
            
            for ch in single_chars {
                if !tokens.contains(&ch) {
                    tokens.push(ch);
                }
            }
        }
        
        tokens
    }

    pub fn generate_ngrams(&self, text: &str, n: usize) -> Vec<String> {
        let chars: Vec<char> = text.chars().collect();
        let mut ngrams = Vec::new();
        
        if chars.len() < n {
            return ngrams;
        }
        
        for i in 0..=chars.len().saturating_sub(n) {
            let window: String = chars[i..i + n].iter().collect();
            
            let has_chinese = window.chars().any(is_chinese);
            if has_chinese {
                let all_valid = window.chars().all(|c| 
                    is_chinese(c) || c.is_ascii_alphanumeric()
                );
                if all_valid {
                    ngrams.push(window);
                }
            }
        }
        
        ngrams
    }

    pub fn search_tokens_with_fallback(&self, query: &str) -> Vec<String> {
        let mut primary_tokens = self.tokenize(query, true);
        
        if primary_tokens.len() >= 2 {
            return primary_tokens;
        }
        
        let mut all_tokens = primary_tokens.clone();
        
        let bigrams = self.generate_ngrams(query, 2);
        for gram in bigrams {
            if !all_tokens.contains(&gram) {
                all_tokens.push(gram);
            }
        }
        
        let chars: Vec<String> = query
            .chars()
            .filter(|c| is_chinese(*c) || c.is_ascii_alphanumeric())
            .map(|c| c.to_string())
            .collect();
        
        for ch in chars {
            if !all_tokens.contains(&ch) {
                all_tokens.push(ch);
            }
        }
        
        all_tokens
    }

    pub fn tokenize_with_positions(&self, text: &str) -> Vec<(String, usize, usize)> {
        let jieba = JIEBA.lock().unwrap();
        let tokens = jieba.cut(text, true);
        
        let mut positions: Vec<(String, usize, usize)> = Vec::new();
        let mut current_pos = 0usize;
        
        for token in tokens {
            if token.trim().is_empty() {
                current_pos += token.chars().count();
                continue;
            }
            
            let token_len = token.chars().count();
            positions.push((token.to_string(), current_pos, current_pos + token_len));
            current_pos += token_len;
        }
        
        positions
    }
}

impl Default for ChineseTokenizer {
    fn default() -> Self {
        Self::new()
    }
}

pub fn is_chinese(c: char) -> bool {
    (c >= '\u{4e00}' && c <= '\u{9fff}') ||
    (c >= '\u{3400}' && c <= '\u{4dbf}') ||
    (c >= '\u{20000}' && c <= '\u{2a6df}') ||
    (c >= '\u{f900}' && c <= '\u{faff}') ||
    (c >= '\u{2f800}' && c <= '\u{2fa1f}')
}

pub fn contains_chinese(text: &str) -> bool {
    text.chars().any(is_chinese)
}

pub fn split_mixed_text(text: &str) -> Vec<TextSegment> {
    let mut segments = Vec::new();
    let mut current = String::new();
    let mut current_is_chinese = false;
    
    for c in text.chars() {
        let is_c = is_chinese(c) || c.is_ascii_digit();
        
        if current.is_empty() {
            current_is_chinese = is_c;
            current.push(c);
        } else if current_is_chinese == is_c {
            current.push(c);
        } else {
            segments.push(TextSegment {
                text: current,
                is_chinese: current_is_chinese,
            });
            current = String::new();
            current.push(c);
            current_is_chinese = is_c;
        }
    }
    
    if !current.is_empty() {
        segments.push(TextSegment {
            text: current,
            is_chinese: current_is_chinese,
        });
    }
    
    segments
}

#[derive(Debug, Clone)]
pub struct TextSegment {
    pub text: String,
    pub is_chinese: bool,
}

pub fn highlight_matches(
    text: &str,
    search_term: &str,
    highlight_color: &str,
) -> String {
    if search_term.is_empty() {
        return text.to_string();
    }
    
    let tokenizer = ChineseTokenizer::new();
    let search_tokens = tokenizer.tokenize(search_term, true);
    
    if search_tokens.is_empty() {
        return text.to_string();
    }
    
    let mut result = String::new();
    let mut last_end = 0;
    
    let positions = tokenizer.tokenize_with_positions(text);
    
    let mut matched_ranges: Vec<(usize, usize)> = Vec::new();
    
    for (token, start, end) in &positions {
        for search_token in &search_tokens {
            if token.to_lowercase().contains(&search_token.to_lowercase()) 
                || search_token.to_lowercase().contains(&token.to_lowercase()) {
                matched_ranges.push((*start, *end));
            }
        }
    }
    
    if text.to_lowercase().contains(&search_term.to_lowercase()) {
        let mut pos = 0;
        while let Some(found) = text[pos..].to_lowercase().find(&search_term.to_lowercase()) {
            let start = pos + found;
            let end = start + search_term.len();
            matched_ranges.push((start, end));
            pos = end;
        }
    }
    
    matched_ranges.sort();
    matched_ranges.dedup();
    
    let merged = merge_ranges(&matched_ranges);
    
    for (start, end) in merged {
        if start >= text.len() {
            break;
        }
        let end = end.min(text.len());
        
        if start > last_end {
            result.push_str(&text[last_end..start]);
        }
        
        result.push_str(&format!(
            "<span class=\"highlight\" style=\"background-color: {};\">{}</span>",
            highlight_color,
            &text[start..end]
        ));
        
        last_end = end;
    }
    
    if last_end < text.len() {
        result.push_str(&text[last_end..]);
    }
    
    if result.is_empty() {
        result = text.to_string();
    }
    
    result
}

fn merge_ranges(ranges: &[(usize, usize)]) -> Vec<(usize, usize)> {
    if ranges.is_empty() {
        return Vec::new();
    }
    
    let mut result = Vec::new();
    let mut current_start = ranges[0].0;
    let mut current_end = ranges[0].1;
    
    for &(start, end) in &ranges[1..] {
        if start <= current_end {
            current_end = current_end.max(end);
        } else {
            result.push((current_start, current_end));
            current_start = start;
            current_end = end;
        }
    }
    
    result.push((current_start, current_end));
    result
}
