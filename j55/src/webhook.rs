use crate::db::TamperResult;
use crate::metrics;
use serde::{Deserialize, Serialize};
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookAlert {
    pub alert_type: String,
    pub timestamp: u64,
    pub severity: String,
    pub summary: String,
    pub details: AlertDetails,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertDetails {
    pub watch_dir: String,
    pub modified_files: Vec<TamperedFileInfo>,
    pub deleted_files: Vec<String>,
    pub added_files: Vec<String>,
    pub total_tampered: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TamperedFileInfo {
    pub path: String,
    pub baseline_hash: String,
    pub current_hash: String,
}

impl WebhookAlert {
    pub fn from_tamper_result(
        result: &TamperResult,
        watch_dir: &str,
    ) -> Self {
        let modified = result
            .modified
            .iter()
            .map(|f| TamperedFileInfo {
                path: f.path.clone(),
                baseline_hash: f.baseline_hash.clone(),
                current_hash: f.current_hash.clone(),
            })
            .collect();

        let total = result.modified.len() + result.deleted.len() + result.added.len();
        let summary = format!(
            "File tampering detected: {} modified, {} deleted, {} added",
            result.modified.len(),
            result.deleted.len(),
            result.added.len()
        );

        Self {
            alert_type: "file_tampering".to_string(),
            timestamp: SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
            severity: "critical".to_string(),
            summary,
            details: AlertDetails {
                watch_dir: watch_dir.to_string(),
                modified_files: modified,
                deleted_files: result.deleted.clone(),
                added_files: result.added.clone(),
                total_tampered: total,
            },
        }
    }
}

pub async fn send_webhook(url: &str, alert: &WebhookAlert) -> Result<(), String> {
    if url.is_empty() {
        return Ok(());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    match client.post(url).json(alert).send().await {
        Ok(response) => {
            let status = response.status();
            if status.is_success() {
                metrics::record_webhook(true);
                log::info!("Webhook sent successfully to {}", url);
                Ok(())
            } else {
                metrics::record_webhook(false);
                let body = response.text().await.unwrap_or_default();
                Err(format!(
                    "Webhook failed with status {}: {}",
                    status, body
                ))
            }
        }
        Err(e) => {
            metrics::record_webhook(false);
            Err(format!("Webhook request failed: {}", e))
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryAlert {
    pub alert_type: String,
    pub timestamp: u64,
    pub severity: String,
    pub summary: String,
    pub details: RecoveryDetails,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryDetails {
    pub file_path: String,
    pub backup_path: String,
    pub success: bool,
    pub error: Option<String>,
}

impl RecoveryAlert {
    pub fn new(file_path: &str, backup_path: &str, success: bool, error: Option<String>) -> Self {
        let summary = if success {
            format!("File recovered successfully: {}", file_path)
        } else {
            format!("File recovery failed: {}", file_path)
        };

        Self {
            alert_type: "file_recovery".to_string(),
            timestamp: SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
            severity: if success { "info" } else { "warning" }.to_string(),
            summary,
            details: RecoveryDetails {
                file_path: file_path.to_string(),
                backup_path: backup_path.to_string(),
                success,
                error,
            },
        }
    }
}

pub async fn send_recovery_webhook(url: &str, alert: &RecoveryAlert) -> Result<(), String> {
    if url.is_empty() {
        return Ok(());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    match client.post(url).json(alert).send().await {
        Ok(response) => {
            let status = response.status();
            if status.is_success() {
                metrics::record_webhook(true);
                Ok(())
            } else {
                metrics::record_webhook(false);
                let body = response.text().await.unwrap_or_default();
                Err(format!(
                    "Recovery webhook failed with status {}: {}",
                    status, body
                ))
            }
        }
        Err(e) => {
            metrics::record_webhook(false);
            Err(format!("Recovery webhook request failed: {}", e))
        }
    }
}
