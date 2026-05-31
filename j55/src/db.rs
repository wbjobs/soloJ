use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileRecord {
    pub path: String,
    pub hash: String,
    pub recorded_at: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChangeType {
    Modified,
    Created,
    Deleted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeHistory {
    pub id: i64,
    pub path: String,
    pub change_type: String,
    pub old_hash: Option<String>,
    pub new_hash: Option<String>,
    pub detected_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryHistory {
    pub id: i64,
    pub file_path: String,
    pub backup_path: String,
    pub success: bool,
    pub error_message: Option<String>,
    pub recovered_at: String,
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn open(path: &str) -> Result<Self, String> {
        let conn = Connection::open(path).map_err(|e| e.to_string())?;
        
        conn.pragma_update(None, "journal_mode", "WAL")
            .map_err(|e| format!("Failed to enable WAL mode: {}", e))?;
        
        conn.pragma_update(None, "busy_timeout", 5000)
            .map_err(|e| format!("Failed to set busy timeout: {}", e))?;
        
        conn.pragma_update(None, "synchronous", "NORMAL")
            .map_err(|e| format!("Failed to set synchronous mode: {}", e))?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS baseline (
                path TEXT PRIMARY KEY,
                hash TEXT NOT NULL,
                recorded_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS change_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL,
                change_type TEXT NOT NULL,
                old_hash TEXT,
                new_hash TEXT,
                detected_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS recovery_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                backup_path TEXT NOT NULL,
                success INTEGER NOT NULL,
                error_message TEXT,
                recovered_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_change_history_path ON change_history(path);
            CREATE INDEX IF NOT EXISTS idx_change_history_time ON change_history(detected_at);
            CREATE INDEX IF NOT EXISTS idx_recovery_history_time ON recovery_history(recovered_at);"
        ).map_err(|e| e.to_string())?;

        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn replace_baseline(&self, records: &[FileRecord]) -> Result<usize, String> {
        let mut conn = self.conn.lock().map_err(|e| e.to_string())?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        tx.execute("DELETE FROM baseline", []).map_err(|e| e.to_string())?;

        {
            let mut stmt = tx.prepare(
                "INSERT INTO baseline (path, hash, recorded_at) VALUES (?1, ?2, ?3)"
            ).map_err(|e| e.to_string())?;

            for rec in records {
                stmt.execute(params![rec.path, rec.hash, rec.recorded_at])
                    .map_err(|e| format!("Insert failed for {}: {}", rec.path, e))?;
            }
        }

        tx.commit().map_err(|e| e.to_string())?;
        Ok(records.len())
    }

    pub fn get_baseline(&self) -> Result<Vec<FileRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT path, hash, recorded_at FROM baseline")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(FileRecord {
                    path: row.get(0)?,
                    hash: row.get(1)?,
                    recorded_at: row.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut records = Vec::new();
        for row in rows {
            records.push(row.map_err(|e| e.to_string())?);
        }
        Ok(records)
    }

    pub fn update_file_hash(&self, path: &str, new_hash: &str, recorded_at: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO baseline (path, hash, recorded_at) VALUES (?1, ?2, ?3)",
            params![path, new_hash, recorded_at],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn remove_file_from_baseline(&self, path: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM baseline WHERE path = ?1", params![path])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn add_change_history(&self, path: &str, change_type: &str, old_hash: Option<&str>, new_hash: Option<&str>) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let detected_at = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO change_history (path, change_type, old_hash, new_hash, detected_at) 
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![path, change_type, old_hash, new_hash, detected_at],
        ).map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_change_history(&self, limit: i64) -> Result<Vec<ChangeHistory>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT id, path, change_type, old_hash, new_hash, detected_at 
             FROM change_history 
             ORDER BY detected_at DESC 
             LIMIT ?1"
        ).map_err(|e| e.to_string())?;
        
        let rows = stmt.query_map(params![limit], |row| {
            Ok(ChangeHistory {
                id: row.get(0)?,
                path: row.get(1)?,
                change_type: row.get(2)?,
                old_hash: row.get(3)?,
                new_hash: row.get(4)?,
                detected_at: row.get(5)?,
            })
        }).map_err(|e| e.to_string())?;

        let mut history = Vec::new();
        for row in rows {
            history.push(row.map_err(|e| e.to_string())?);
        }
        Ok(history)
    }

    pub fn add_recovery_history(
        &self,
        file_path: &str,
        backup_path: &str,
        success: bool,
        error_message: Option<&str>,
    ) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let recovered_at = chrono::Utc::now().to_rfc3339();
        let success_int = if success { 1 } else { 0 };
        conn.execute(
            "INSERT INTO recovery_history (file_path, backup_path, success, error_message, recovered_at) 
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![file_path, backup_path, success_int, error_message, recovered_at],
        ).map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_recovery_history(&self, limit: i64) -> Result<Vec<RecoveryHistory>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT id, file_path, backup_path, success, error_message, recovered_at 
             FROM recovery_history 
             ORDER BY recovered_at DESC 
             LIMIT ?1"
        ).map_err(|e| e.to_string())?;
        
        let rows = stmt.query_map(params![limit], |row| {
            let success_int: i32 = row.get(3)?;
            Ok(RecoveryHistory {
                id: row.get(0)?,
                file_path: row.get(1)?,
                backup_path: row.get(2)?,
                success: success_int != 0,
                error_message: row.get(4)?,
                recovered_at: row.get(5)?,
            })
        }).map_err(|e| e.to_string())?;

        let mut history = Vec::new();
        for row in rows {
            history.push(row.map_err(|e| e.to_string())?);
        }
        Ok(history)
    }

    pub fn find_tampered(&self, current: &[(PathBuf, String)]) -> Result<TamperResult, String> {
        let baseline = self.get_baseline()?;
        let base_map: std::collections::HashMap<&str, &str> = baseline
            .iter()
            .map(|r| (r.path.as_str(), r.hash.as_str()))
            .collect();
        let cur_map: std::collections::HashMap<&str, &str> = current
            .iter()
            .map(|(p, h)| (p.to_str().unwrap_or(""), h.as_str()))
            .collect();

        let mut modified: Vec<TamperedFile> = Vec::new();
        let mut deleted: Vec<String> = Vec::new();
        let mut added: Vec<String> = Vec::new();

        for (path_str, old_hash) in &base_map {
            match cur_map.get(path_str) {
                Some(new_hash) if new_hash != old_hash => {
                    modified.push(TamperedFile {
                        path: (*path_str).to_string(),
                        baseline_hash: (*old_hash).to_string(),
                        current_hash: (*new_hash).to_string(),
                    });
                }
                None => {
                    deleted.push((*path_str).to_string());
                }
                _ => {}
            }
        }

        for path_str in cur_map.keys() {
            if !base_map.contains_key(path_str) {
                added.push((*path_str).to_string());
            }
        }

        let is_clean = modified.is_empty() && deleted.is_empty() && added.is_empty();

        Ok(TamperResult {
            modified,
            deleted,
            added,
            is_clean,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TamperedFile {
    pub path: String,
    pub baseline_hash: String,
    pub current_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TamperResult {
    pub modified: Vec<TamperedFile>,
    pub deleted: Vec<String>,
    pub added: Vec<String>,
    pub is_clean: bool,
}
