use std::path::PathBuf;
use rusqlite::{params, Connection, Result};
use tracing::{info, debug, warn};
use crate::types::*;
use crate::AppResult;
use super::tokenizer::ChineseTokenizer;

pub struct SearchIndexer {
    conn: Connection,
    tokenizer: ChineseTokenizer,
}

impl SearchIndexer {
    pub fn new(path: &PathBuf) -> AppResult<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        
        let conn = Connection::open(path)?;
        
        let indexer = SearchIndexer {
            conn,
            tokenizer: ChineseTokenizer::new(),
        };
        
        indexer.init_schema()?;
        
        Ok(indexer)
    }
    
    pub fn new_in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        
        let indexer = SearchIndexer {
            conn,
            tokenizer: ChineseTokenizer::new(),
        };
        
        indexer.init_schema()?;
        
        Ok(indexer)
    }
    
    fn init_schema(&self) -> AppResult<()> {
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS books (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                authors TEXT,
                publisher TEXT,
                publish_date TEXT,
                language TEXT,
                description TEXT,
                tags TEXT,
                source_path TEXT,
                original_format TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS chapters (
                id TEXT PRIMARY KEY,
                book_id TEXT NOT NULL,
                title TEXT NOT NULL,
                chapter_order INTEGER NOT NULL,
                FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
            );
            
            CREATE TABLE IF NOT EXISTS elements (
                id TEXT PRIMARY KEY,
                chapter_id TEXT NOT NULL,
                book_id TEXT NOT NULL,
                element_type TEXT NOT NULL,
                content TEXT NOT NULL,
                start_pos INTEGER,
                end_pos INTEGER,
                FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
                FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
            );
            
            CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
                content,
                book_id,
                chapter_id,
                element_id,
                tokenize = 'unicode61'
            );
            
            CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON chapters(book_id);
            CREATE INDEX IF NOT EXISTS idx_elements_chapter_id ON elements(chapter_id);
            CREATE INDEX IF NOT EXISTS idx_elements_book_id ON elements(book_id);
            ",
        )?;
        
        Ok(())
    }
    
    pub fn index_book(&mut self, book: &ParsedBook) -> AppResult<u32> {
        info!("Indexing book: {}", book.metadata.title);
        
        let book_id = uuid::Uuid::new_v4().to_string();
        
        let authors = book.metadata.authors.join(", ");
        let tags = book.metadata.tags.join(", ");
        
        self.conn.execute(
            "INSERT INTO books (
                id, title, authors, publisher, publish_date, 
                language, description, tags, source_path, original_format
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                book_id,
                book.metadata.title,
                authors,
                book.metadata.publisher,
                book.metadata.publish_date,
                book.metadata.language,
                book.metadata.description,
                tags,
                book.source_path,
                format!("{:?}", book.original_format),
            ],
        )?;
        
        let mut element_count = 0u32;
        
        for chapter in &book.chapters {
            let chapter_id = &chapter.id;
            
            self.conn.execute(
                "INSERT INTO chapters (id, book_id, title, chapter_order) 
                 VALUES (?1, ?2, ?3, ?4)",
                params![chapter_id, book_id, chapter.title, chapter.order],
            )?;
            
            element_count += self.index_chapter_elements(&book_id, chapter)?;
        }
        
        debug!("Indexed {} elements for book {}", element_count, book.metadata.title);
        
        Ok(element_count)
    }
    
    fn index_chapter_elements(
        &mut self,
        book_id: &str,
        chapter: &BookChapter,
    ) -> AppResult<u32> {
        let mut count = 0u32;
        let mut position = 0usize;
        
        for element in &chapter.elements {
            count += self.index_element_recursive(
                book_id,
                &chapter.id,
                element,
                &mut position,
            )?;
        }
        
        Ok(count)
    }
    
    fn index_element_recursive(
        &mut self,
        book_id: &str,
        chapter_id: &str,
        element: &ContentElement,
        position: &mut usize,
    ) -> AppResult<u32> {
        let mut count = 0u32;
        
        if !element.content.trim().is_empty() {
            let tokens = self.tokenizer.tokenize_for_index(&element.content);
            let indexed_content = tokens.join(" ");
            
            let content_len = element.content.chars().count();
            let start_pos = *position;
            let end_pos = *position + content_len;
            
            self.conn.execute(
                "INSERT INTO elements (
                    id, chapter_id, book_id, element_type, 
                    content, start_pos, end_pos
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    element.id,
                    chapter_id,
                    book_id,
                    element.element_type,
                    element.content,
                    start_pos as i64,
                    end_pos as i64,
                ],
            )?;
            
            self.conn.execute(
                "INSERT INTO content_fts (content, book_id, chapter_id, element_id) 
                 VALUES (?1, ?2, ?3, ?4)",
                params![
                    indexed_content,
                    book_id,
                    chapter_id,
                    element.id,
                ],
            )?;
            
            *position += content_len;
            count += 1;
        }
        
        for child in &element.children {
            count += self.index_element_recursive(book_id, chapter_id, child, position)?;
        }
        
        Ok(count)
    }
    
    pub fn delete_book(&mut self, book_id: &str) -> AppResult<()> {
        self.conn.execute("DELETE FROM books WHERE id = ?1", params![book_id])?;
        self.conn.execute("DELETE FROM chapters WHERE book_id = ?1", params![book_id])?;
        self.conn.execute("DELETE FROM elements WHERE book_id = ?1", params![book_id])?;
        self.conn.execute("DELETE FROM content_fts WHERE book_id = ?1", params![book_id])?;
        Ok(())
    }
    
    pub fn clear(&mut self) -> AppResult<()> {
        self.conn.execute("DELETE FROM content_fts", [])?;
        self.conn.execute("DELETE FROM elements", [])?;
        self.conn.execute("DELETE FROM chapters", [])?;
        self.conn.execute("DELETE FROM books", [])?;
        Ok(())
    }
    
    pub fn get_book_count(&self) -> AppResult<u32> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM books",
            [],
            |row| row.get(0),
        )?;
        Ok(count as u32)
    }
    
    pub fn get_element_count(&self) -> AppResult<u32> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM elements",
            [],
            |row| row.get(0),
        )?;
        Ok(count as u32)
    }
    
    pub fn optimize(&self) -> AppResult<()> {
        self.conn.execute("INSERT INTO content_fts(content_fts) VALUES('optimize')", [])?;
        Ok(())
    }
    
    pub fn get_connection(&self) -> &Connection {
        &self.conn
    }
}
