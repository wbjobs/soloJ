use std::path::PathBuf;
use std::time::Instant;
use rusqlite::{params, OptionalExtension};
use tracing::{info, debug};
use crate::types::*;
use crate::AppResult;
use super::tokenizer::{ChineseTokenizer, highlight_matches, contains_chinese};
use super::indexer::SearchIndexer;

pub struct SearchEngine {
    indexer: SearchIndexer,
    tokenizer: ChineseTokenizer,
}

impl SearchEngine {
    pub fn new(index_path: &PathBuf) -> AppResult<Self> {
        Ok(SearchEngine {
            indexer: SearchIndexer::new(index_path)?,
            tokenizer: ChineseTokenizer::new(),
        })
    }
    
    pub fn new_in_memory() -> AppResult<Self> {
        Ok(SearchEngine {
            indexer: SearchIndexer::new_in_memory()?,
            tokenizer: ChineseTokenizer::new(),
        })
    }
    
    pub fn index_book(&mut self, book: &ParsedBook) -> AppResult<u32> {
        self.indexer.index_book(book)
    }
    
    pub fn search(
        &self,
        query: &str,
        limit: u32,
        offset: u32,
        include_snippet: bool,
    ) -> AppResult<SearchResult> {
        let start_time = Instant::now();
        
        debug!("Searching for: {}", query);
        
        let mut tokens = self.tokenizer.tokenize(query, true);
        let mut used_fallback = false;
        
        if tokens.is_empty() {
            return Ok(SearchResult {
                term: query.to_string(),
                total_results: 0,
                results: Vec::new(),
                search_time_ms: 0,
            });
        }
        
        let mut fts_query = self.build_fts_query(&tokens);
        debug!("FTS query: {}", fts_query);
        
        let mut total: i64 = self.indexer.get_connection().query_row(
            &format!(
                "SELECT COUNT(*) FROM content_fts WHERE content_fts MATCH '{}'",
                self.escape_fts_query(&fts_query)
            ),
            [],
            |row| row.get(0),
        ).unwrap_or(0);
        
        if total == 0 {
            debug!("Primary search returned 0 results, trying fallback with N-grams");
            
            let fallback_tokens = self.tokenizer.search_tokens_with_fallback(query);
            if fallback_tokens.len() > tokens.len() {
                tokens = fallback_tokens;
                fts_query = self.build_fts_query(&tokens);
                used_fallback = true;
                
                debug!("Fallback FTS query: {}", fts_query);
                
                total = self.indexer.get_connection().query_row(
                    &format!(
                        "SELECT COUNT(*) FROM content_fts WHERE content_fts MATCH '{}'",
                        self.escape_fts_query(&fts_query)
                    ),
                    [],
                    |row| row.get(0),
                ).unwrap_or(0);
            }
        }
        
        if total == 0 && contains_chinese(query) && query.chars().count() >= 2 {
            debug!("Still no results, trying partial matching");
            
            let mut partial_queries: Vec<String> = Vec::new();
            
            if query.chars().count() >= 4 {
                let chars: Vec<char> = query.chars().collect();
                for i in 0..chars.len().saturating_sub(1) {
                    let two_chars: String = chars[i..i+2].iter().collect();
                    partial_queries.push(format!("\"{}\"", self.escape_fts_token(&two_chars)));
                }
            }
            
            if !partial_queries.is_empty() {
                let partial_fts = partial_queries.join(" OR ");
                debug!("Partial FTS query: {}", partial_fts);
                
                total = self.indexer.get_connection().query_row(
                    &format!(
                        "SELECT COUNT(*) FROM content_fts WHERE content_fts MATCH '{}'",
                        self.escape_fts_query(&partial_fts)
                    ),
                    [],
                    |row| row.get(0),
                ).unwrap_or(0);
                
                if total > 0 {
                    fts_query = partial_fts;
                    used_fallback = true;
                }
            }
        }
        
        let sql = format!(
            "SELECT 
                c.book_id,
                c.chapter_id,
                ch.title as chapter_title,
                c.element_id,
                c.content,
                c.start_pos,
                c.end_pos,
                b.title as book_title,
                rank
             FROM content_fts c
             JOIN chapters ch ON c.chapter_id = ch.id
             JOIN books b ON c.book_id = b.id
             WHERE content_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2 OFFSET ?3"
        );
        
        let mut stmt = self.indexer.get_connection().prepare(&sql)?;
        
        let rows = stmt.query_map(
            params![fts_query, limit as i64, offset as i64],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, Option<i64>>(5)?,
                    row.get::<_, Option<i64>>(6)?,
                    row.get::<_, f64>(8)?,
                ))
            },
        )?;
        
        let mut results: Vec<SearchMatch> = Vec::new();
        
        for row in rows {
            let (book_id, chapter_id, chapter_title, element_id, content, start_pos, end_pos, rank) = row?;
            
            let snippet = if include_snippet {
                self.generate_snippet(&content, query)
            } else {
                content.clone()
            };
            
            let mut score = if rank > 0.0 { 1.0 / (rank as f32 + 1.0) } else { 1.0 };
            if used_fallback {
                score *= 0.8;
            }
            
            results.push(SearchMatch {
                book_id,
                chapter_id,
                chapter_title,
                element_id,
                snippet: highlight_matches(&snippet, query, "#ffff00"),
                start_pos: start_pos.unwrap_or(0) as u32,
                end_pos: end_pos.unwrap_or(0) as u32,
                score,
            });
        }
        
        let elapsed = start_time.elapsed();
        
        info!(
            "Search for '{}' returned {} results in {}ms{}",
            query,
            total,
            elapsed.as_millis(),
            if used_fallback { " (with fallback)" } else { "" }
        );
        
        Ok(SearchResult {
            term: query.to_string(),
            total_results: total as u32,
            results,
            search_time_ms: elapsed.as_millis() as u64,
        })
    }
    
    pub fn search_in_book(
        &self,
        book_id: &str,
        query: &str,
        limit: u32,
    ) -> AppResult<SearchResult> {
        let start_time = Instant::now();
        
        let tokens = self.tokenizer.tokenize(query, true);
        
        if tokens.is_empty() {
            return Ok(SearchResult {
                term: query.to_string(),
                total_results: 0,
                results: Vec::new(),
                search_time_ms: 0,
            });
        }
        
        let fts_query = self.build_fts_query(&tokens);
        
        let total: i64 = self.indexer.get_connection().query_row(
            &format!(
                "SELECT COUNT(*) FROM content_fts 
                 WHERE book_id = ?1 AND content_fts MATCH '{}'",
                self.escape_fts_query(&fts_query)
            ),
            params![book_id],
            |row| row.get(0),
        ).unwrap_or(0);
        
        let sql = format!(
            "SELECT 
                c.chapter_id,
                ch.title as chapter_title,
                c.element_id,
                c.content,
                c.start_pos,
                c.end_pos,
                rank
             FROM content_fts c
             JOIN chapters ch ON c.chapter_id = ch.id
             WHERE c.book_id = ?1 AND content_fts MATCH ?2
             ORDER BY rank
             LIMIT ?3"
        );
        
        let mut stmt = self.indexer.get_connection().prepare(&sql)?;
        
        let rows = stmt.query_map(
            params![book_id, fts_query, limit as i64],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, Option<i64>>(4)?,
                    row.get::<_, Option<i64>>(5)?,
                    row.get::<_, f64>(6)?,
                ))
            },
        )?;
        
        let mut results: Vec<SearchMatch> = Vec::new();
        
        for row in rows {
            let (chapter_id, chapter_title, element_id, content, start_pos, end_pos, rank) = row?;
            
            let snippet = self.generate_snippet(&content, query);
            
            results.push(SearchMatch {
                book_id: book_id.to_string(),
                chapter_id,
                chapter_title,
                element_id,
                snippet: highlight_matches(&snippet, query, "#ffff00"),
                start_pos: start_pos.unwrap_or(0) as u32,
                end_pos: end_pos.unwrap_or(0) as u32,
                score: if rank > 0.0 { 1.0 / (rank as f32 + 1.0) } else { 1.0 },
            });
        }
        
        let elapsed = start_time.elapsed();
        
        Ok(SearchResult {
            term: query.to_string(),
            total_results: total as u32,
            results,
            search_time_ms: elapsed.as_millis() as u64,
        })
    }
    
    fn build_fts_query(&self, tokens: &[String]) -> String {
        let mut parts: Vec<String> = Vec::new();
        
        for token in tokens {
            if token.len() >= 2 {
                parts.push(format!("\"{}\"", self.escape_fts_token(token)));
                if !token.chars().all(|c| c.is_ascii_alphanumeric()) {
                    parts.push(format!("{}*", self.escape_fts_token(token)));
                }
            } else if !token.is_empty() {
                parts.push(format!("\"{}\"", self.escape_fts_token(token)));
            }
        }
        
        if parts.is_empty() {
            for token in tokens {
                parts.push(format!("\"{}\"", self.escape_fts_token(token)));
            }
        }
        
        parts.join(" OR ")
    }
    
    fn escape_fts_token(&self, token: &str) -> String {
        token.replace('"', "\"\"").replace('\'', "''")
    }
    
    fn escape_fts_query(&self, query: &str) -> String {
        query.replace('\'', "''")
    }
    
    fn generate_snippet(&self, content: &str, query: &str) -> String {
        const MAX_SNIPPET_LENGTH: usize = 200;
        const CONTEXT_CHARS: usize = 30;
        
        if content.len() <= MAX_SNIPPET_LENGTH {
            return content.to_string();
        }
        
        let query_lower = query.to_lowercase();
        let content_lower = content.to_lowercase();
        
        if let Some(pos) = content_lower.find(&query_lower) {
            let start = pos.saturating_sub(CONTEXT_CHARS);
            let mut end = (pos + query.len() + CONTEXT_CHARS).min(content.len());
            
            while end < content.len() && end - start < MAX_SNIPPET_LENGTH && !content.is_char_boundary(end) {
                end += 1;
            }
            while start > 0 && !content.is_char_boundary(start) {
                start -= 1;
            }
            
            let mut snippet = String::new();
            if start > 0 {
                snippet.push_str("...");
            }
            snippet.push_str(&content[start..end]);
            if end < content.len() {
                snippet.push_str("...");
            }
            
            snippet
        } else {
            let tokens = self.tokenizer.tokenize(query, true);
            let mut best_pos = 0;
            let mut max_matches = 0;
            
            for token in tokens {
                if let Some(pos) = content_lower.find(&token.to_lowercase()) {
                    let window_start = pos.saturating_sub(50);
                    let window_end = (pos + 100).min(content.len());
                    let window = &content_lower[window_start..window_end];
                    
                    let matches = window.matches(&token.to_lowercase()).count();
                    if matches > max_matches {
                        max_matches = matches;
                        best_pos = window_start;
                    }
                }
            }
            
            let end = (best_pos + MAX_SNIPPET_LENGTH).min(content.len());
            let mut snippet = String::new();
            if best_pos > 0 {
                snippet.push_str("...");
            }
            snippet.push_str(&content[best_pos..end]);
            if end < content.len() {
                snippet.push_str("...");
            }
            
            snippet
        }
    }
    
    pub fn suggest_completions(&self, prefix: &str, limit: u32) -> AppResult<Vec<String>> {
        if prefix.len() < 2 {
            return Ok(Vec::new());
        }
        
        let tokens = self.tokenizer.tokenize(prefix, true);
        if tokens.is_empty() {
            return Ok(Vec::new());
        }
        
        let last_token = tokens.last().unwrap();
        let search_prefix = format!("{}*", self.escape_fts_token(last_token));
        
        let sql = format!(
            "SELECT DISTINCT substr(content, instr(content, ?1), 50) as suggestion
             FROM content_fts
             WHERE content_fts MATCH ?2
             LIMIT ?3"
        );
        
        let mut stmt = self.indexer.get_connection().prepare(&sql)?;
        
        let rows = stmt.query_map(
            params![last_token, search_prefix, limit as i64],
            |row| row.get::<_, String>(0),
        )?;
        
        let mut suggestions: Vec<String> = Vec::new();
        for row in rows {
            if let Ok(s) = row {
                let trimmed = s.trim().to_string();
                if !trimmed.is_empty() && !suggestions.contains(&trimmed) {
                    suggestions.push(trimmed);
                }
            }
        }
        
        Ok(suggestions)
    }
    
    pub fn get_book_metadata(&self, book_id: &str) -> AppResult<Option<BookMetadata>> {
        let result = self.indexer.get_connection().query_row(
            "SELECT title, authors, publisher, publish_date, language, description, 
                    tags, source_path, original_format
             FROM books WHERE id = ?1",
            params![book_id],
            |row| {
                let title: String = row.get(0)?;
                let authors_str: String = row.get(1)?;
                let publisher: Option<String> = row.get(2)?;
                let publish_date: Option<String> = row.get(3)?;
                let language: Option<String> = row.get(4)?;
                let description: Option<String> = row.get(5)?;
                let tags_str: String = row.get(6)?;
                let source_path: String = row.get(7)?;
                let original_format_str: String = row.get(8)?;
                
                let authors: Vec<String> = authors_str
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                
                let tags: Vec<String> = tags_str
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                
                let original_format = match original_format_str.as_str() {
                    "Pdf" => BookFormat::Pdf,
                    "Epub" => BookFormat::Epub,
                    "Azw3" => BookFormat::Azw3,
                    "Mobi" => BookFormat::Mobi,
                    _ => BookFormat::Unknown,
                };
                
                Ok(BookMetadata {
                    title,
                    authors,
                    publisher,
                    publish_date,
                    isbn: None,
                    language,
                    description,
                    cover_image: None,
                    tags,
                    page_count: None,
                    file_size: 0,
                    format: original_format,
                    drm_protected: None,
                })
            },
        ).optional()?;
        
        Ok(result)
    }
    
    pub fn list_books(&self, limit: u32, offset: u32) -> AppResult<Vec<(String, BookMetadata)>> {
        let mut stmt = self.indexer.get_connection().prepare(
            "SELECT id, title, authors, publisher, publish_date, language, 
                    description, tags, source_path, original_format
             FROM books
             ORDER BY updated_at DESC
             LIMIT ?1 OFFSET ?2"
        )?;
        
        let rows = stmt.query_map(
            params![limit as i64, offset as i64],
            |row| {
                let id: String = row.get(0)?;
                let title: String = row.get(1)?;
                let authors_str: String = row.get(2)?;
                let publisher: Option<String> = row.get(3)?;
                let publish_date: Option<String> = row.get(4)?;
                let language: Option<String> = row.get(5)?;
                let description: Option<String> = row.get(6)?;
                let tags_str: String = row.get(7)?;
                let source_path: String = row.get(8)?;
                let original_format_str: String = row.get(9)?;
                
                let authors: Vec<String> = authors_str
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                
                let tags: Vec<String> = tags_str
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                
                let original_format = match original_format_str.as_str() {
                    "Pdf" => BookFormat::Pdf,
                    "Epub" => BookFormat::Epub,
                    "Azw3" => BookFormat::Azw3,
                    "Mobi" => BookFormat::Mobi,
                    _ => BookFormat::Unknown,
                };
                
                Ok((id, BookMetadata {
                    title,
                    authors,
                    publisher,
                    publish_date,
                    isbn: None,
                    language,
                    description,
                    cover_image: None,
                    tags,
                    page_count: None,
                    file_size: 0,
                    format: original_format,
                    drm_protected: None,
                }))
            },
        )?;
        
        let mut books = Vec::new();
        for row in rows {
            books.push(row?);
        }
        
        Ok(books)
    }
    
    pub fn optimize_index(&self) -> AppResult<()> {
        self.indexer.optimize()
    }
    
    pub fn clear_index(&mut self) -> AppResult<()> {
        self.indexer.clear()
    }
    
    pub fn get_stats(&self) -> AppResult<(u32, u32)> {
        Ok((
            self.indexer.get_book_count()?,
            self.indexer.get_element_count()?,
        ))
    }
    
    pub fn get_indexer(&self) -> &SearchIndexer {
        &self.indexer
    }
    
    pub fn get_indexer_mut(&mut self) -> &mut SearchIndexer {
        &mut self.indexer
    }
}
