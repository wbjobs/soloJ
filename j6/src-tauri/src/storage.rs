use std::path::PathBuf;
use std::sync::Arc;

use sqlx::{SqlitePool, sqlite::SqlitePoolOptions};
use sqlx::Row;

use crate::models::LogMessage;

const MAX_DB_SIZE_BYTES: i64 = 1_073_741_824;

pub struct LogStorage {
    pool: SqlitePool,
    db_path: PathBuf,
}

impl LogStorage {
    pub async fn new(db_path: PathBuf) -> Result<Self, crate::models::AppError> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| crate::models::AppError::IoError(e))?;
        }

        let database_url = format!("sqlite://{}", db_path.display());

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
            .map_err(|e| crate::models::AppError::Other(format!("Database error: {}", e)))?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS log_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                container_id TEXT NOT NULL,
                container_name TEXT NOT NULL,
                stream TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                sent INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            )"
        )
        .execute(&pool)
        .await
        .map_err(|e| crate::models::AppError::Other(format!("Database error: {}", e)))?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_log_cache_container 
             ON log_cache (container_id)"
        )
        .execute(&pool)
        .await
        .map_err(|e| crate::models::AppError::Other(format!("Database error: {}", e)))?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_log_cache_sent 
             ON log_cache (sent)"
        )
        .execute(&pool)
        .await
        .map_err(|e| crate::models::AppError::Other(format!("Database error: {}", e)))?;

        Self::cleanup_if_needed(&pool).await?;

        Ok(Self { pool, db_path })
    }

    pub async fn insert_log(
        &self,
        container_id: &str,
        container_name: &str,
        log: &LogMessage,
    ) -> Result<(), crate::models::AppError> {
        let db_size = self.get_db_size().await?;
        if db_size >= MAX_DB_SIZE_BYTES {
            self.delete_oldest_logs(1000).await?;
        }

        sqlx::query(
            "INSERT INTO log_cache (container_id, container_name, stream, content, timestamp, sent, created_at)
             VALUES (?, ?, ?, ?, ?, 0, ?)"
        )
        .bind(container_id)
        .bind(container_name)
        .bind(&log.stream)
        .bind(&log.content)
        .bind(log.timestamp)
        .bind(chrono::Utc::now().timestamp())
        .execute(&self.pool)
        .await
        .map_err(|e| crate::models::AppError::Other(format!("Database error: {}", e)))?;

        Ok(())
    }

    pub async fn get_unsent_logs(
        &self,
        limit: i64,
    ) -> Result<Vec<CachedLog>, crate::models::AppError> {
        let rows = sqlx::query(
            "SELECT id, container_id, container_name, stream, content, timestamp 
             FROM log_cache 
             WHERE sent = 0 
             ORDER BY id ASC 
             LIMIT ?"
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::models::AppError::Other(format!("Database error: {}", e)))?;

        let logs = rows
            .iter()
            .map(|row| CachedLog {
                id: row.get("id"),
                container_id: row.get("container_id"),
                container_name: row.get("container_name"),
                stream: row.get("stream"),
                content: row.get("content"),
                timestamp: row.get("timestamp"),
            })
            .collect();

        Ok(logs)
    }

    pub async fn mark_as_sent(&self, ids: &[i64]) -> Result<(), crate::models::AppError> {
        if ids.is_empty() {
            return Ok(());
        }

        let placeholders: Vec<String> = ids.iter().enumerate().map(|(i, _)| format!("${}", i + 1)).collect();
        let query_str = format!(
            "UPDATE log_cache SET sent = 1 WHERE id IN ({})",
            placeholders.join(",")
        );

        let mut query = sqlx::query(&query_str);
        for id in ids {
            query = query.bind(id);
        }

        query
            .execute(&self.pool)
            .await
            .map_err(|e| crate::models::AppError::Other(format!("Database error: {}", e)))?;

        Ok(())
    }

    pub async fn get_unsent_count(&self) -> Result<i64, crate::models::AppError> {
        let row = sqlx::query(
            "SELECT COUNT(*) as count FROM log_cache WHERE sent = 0"
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| crate::models::AppError::Other(format!("Database error: {}", e)))?;

        Ok(row.get("count"))
    }

    async fn get_db_size(&self) -> Result<i64, crate::models::AppError> {
        let metadata = std::fs::metadata(&self.db_path)
            .map_err(|e| crate::models::AppError::IoError(e))?;
        Ok(metadata.len() as i64)
    }

    async fn delete_oldest_logs(&self, count: i64) -> Result<(), crate::models::AppError> {
        sqlx::query(
            "DELETE FROM log_cache WHERE id IN (
                SELECT id FROM log_cache ORDER BY id ASC LIMIT ?
            )"
        )
        .bind(count)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::models::AppError::Other(format!("Database error: {}", e)))?;

        Ok(())
    }

    async fn cleanup_if_needed(pool: &SqlitePool) -> Result<(), crate::models::AppError> {
        let total_count: i64 = sqlx::query("SELECT COUNT(*) as count FROM log_cache")
            .fetch_one(pool)
            .await
            .map_err(|e| crate::models::AppError::Other(format!("Database error: {}", e)))?
            .get("count");

        if total_count > 100_000 {
            let to_delete = total_count - 50_000;
            sqlx::query(
                "DELETE FROM log_cache WHERE id IN (
                    SELECT id FROM log_cache ORDER BY id ASC LIMIT ?
                )"
            )
            .bind(to_delete)
            .execute(pool)
            .await
            .map_err(|e| crate::models::AppError::Other(format!("Database error: {}", e)))?;
        }

        Ok(())
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    pub fn path(&self) -> &PathBuf {
        &self.db_path
    }
}

#[derive(Debug, Clone)]
pub struct CachedLog {
    pub id: i64,
    pub container_id: String,
    pub container_name: String,
    pub stream: String,
    pub content: String,
    pub timestamp: i64,
}

impl From<CachedLog> for LogMessage {
    fn from(cached: CachedLog) -> Self {
        LogMessage {
            stream: cached.stream,
            content: cached.content,
            timestamp: cached.timestamp,
        }
    }
}

#[derive(Clone)]
pub struct SharedStorage {
    inner: Arc<LogStorage>,
}

impl SharedStorage {
    pub async fn new(db_path: PathBuf) -> Result<Self, crate::models::AppError> {
        Ok(Self {
            inner: Arc::new(LogStorage::new(db_path).await?),
        })
    }

    pub async fn insert_log(
        &self,
        container_id: &str,
        container_name: &str,
        log: &LogMessage,
    ) -> Result<(), crate::models::AppError> {
        self.inner.insert_log(container_id, container_name, log).await
    }

    pub async fn get_unsent_logs(
        &self,
        limit: i64,
    ) -> Result<Vec<CachedLog>, crate::models::AppError> {
        self.inner.get_unsent_logs(limit).await
    }

    pub async fn mark_as_sent(&self, ids: &[i64]) -> Result<(), crate::models::AppError> {
        self.inner.mark_as_sent(ids).await
    }

    pub async fn get_unsent_count(&self) -> Result<i64, crate::models::AppError> {
        self.inner.get_unsent_count().await
    }
}
