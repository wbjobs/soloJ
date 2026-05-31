use rand::prelude::*;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

pub struct DictionaryMutator {
    words: Vec<Vec<u8>>,
}

impl DictionaryMutator {
    pub fn new(words: Vec<Vec<u8>>) -> Self {
        Self { words }
    }

    pub fn load_from_file(&mut self, path: &Path) -> std::io::Result<()> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);
        
        for line in reader.lines() {
            let line = line?;
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            
            if let Some(stripped) = line.strip_prefix('"').and_then(|s| s.strip_suffix('"')) {
                let parsed = parse_escaped_string(stripped);
                if !parsed.is_empty() {
                    self.words.push(parsed);
                }
            } else {
                let bytes = line.as_bytes().to_vec();
                if !bytes.is_empty() {
                    self.words.push(bytes);
                }
            }
        }
        
        Ok(())
    }

    pub fn is_empty(&self) -> bool {
        self.words.is_empty()
    }

    pub fn mutate(&self, data: &mut Vec<u8>, rng: &mut ThreadRng) {
        if self.words.is_empty() || data.is_empty() {
            return;
        }

        let mutation_type = rng.gen_range(0..3);
        
        match mutation_type {
            0 => self.insert_word(data, rng),
            1 => self.overwrite_with_word(data, rng),
            2 => self.replace_substring(data, rng),
            _ => unreachable!(),
        }
    }

    fn insert_word(&self, data: &mut Vec<u8>, rng: &mut ThreadRng) {
        let word_idx = rng.gen_range(0..self.words.len());
        let word = &self.words[word_idx];
        let pos = rng.gen_range(0..=data.len());
        data.splice(pos..pos, word.clone());
    }

    fn overwrite_with_word(&self, data: &mut Vec<u8>, rng: &mut ThreadRng) {
        let word_idx = rng.gen_range(0..self.words.len());
        let word = &self.words[word_idx];
        
        if data.len() < word.len() {
            self.insert_word(data, rng);
            return;
        }
        
        let pos = rng.gen_range(0..=data.len() - word.len());
        for (i, &b) in word.iter().enumerate() {
            data[pos + i] = b;
        }
    }

    fn replace_substring(&self, data: &mut Vec<u8>, rng: &mut ThreadRng) {
        if self.words.len() < 2 {
            return;
        }
        
        let search_idx = rng.gen_range(0..self.words.len());
        let search_word = &self.words[search_idx];
        
        if let Some(pos) = self.find_subsequence(data, search_word) {
            let replace_idx = rng.gen_range(0..self.words.len());
            let replace_word = &self.words[replace_idx];
            
            data.splice(pos..pos + search_word.len(), replace_word.clone());
        }
    }

    fn find_subsequence(&self, data: &[u8], pattern: &[u8]) -> Option<usize> {
        if pattern.is_empty() || data.len() < pattern.len() {
            return None;
        }
        
        data.windows(pattern.len())
            .position(|window| window == pattern)
    }
}

fn parse_escaped_string(s: &str) -> Vec<u8> {
    let mut result = Vec::new();
    let mut chars = s.chars().peekable();
    
    while let Some(&c) = chars.peek() {
        if c == '\\' {
            chars.next();
            match chars.next() {
                Some('x') => {
                    let mut hex = String::new();
                    hex.push(chars.next().unwrap_or('0'));
                    hex.push(chars.next().unwrap_or('0'));
                    if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                        result.push(byte);
                    }
                }
                Some('n') => result.push(b'\n'),
                Some('r') => result.push(b'\r'),
                Some('t') => result.push(b'\t'),
                Some('0') => result.push(b'\0'),
                Some(c) => result.push(c as u8),
                None => break,
            }
        } else {
            result.push(c as u8);
            chars.next();
        }
    }
    
    result
}

impl Default for DictionaryMutator {
    fn default() -> Self {
        Self::new(Vec::new())
    }
}
