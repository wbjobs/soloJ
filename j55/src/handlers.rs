use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Instant;

use crate::db::{ChangeHistory, Database, FileRecord, RecoveryHistory, TamperResult};
use crate::file_watcher::FileWatcher;
use crate::hasher;
use crate::metrics;
use crate::recovery::RecoveryManager;
use crate::webhook::{send_recovery_webhook, send_webhook, RecoveryAlert, WebhookAlert};

pub struct AppState {
    pub db: Arc<Database>,
    pub watch_dir: PathBuf,
    pub file_watcher: Arc<FileWatcher>,
    pub recovery_manager: Arc<RecoveryManager>,
    pub webhook_url: String,
    pub auto_recover: bool,
}

#[allow(dead_code)]
#[derive(Deserialize)]
pub struct WatchDirQuery {
    pub dir: Option<String>,
}

#[derive(Serialize)]
pub struct BaselineResponse {
    pub success: bool,
    pub message: String,
    pub file_count: usize,
    pub files: Vec<FileRecord>,
}

#[derive(Serialize)]
pub struct VerifyResponse {
    pub success: bool,
    pub message: String,
    pub result: TamperResult,
    pub auto_recovered: Vec<String>,
    pub recovery_failed: Vec<String>,
}

#[derive(Serialize)]
pub struct StatusResponse {
    pub watch_dir: String,
    pub backup_dir: Option<String>,
    pub baseline_count: usize,
    pub monitored_extensions: Vec<String>,
    pub watcher_running: bool,
    pub auto_recover_enabled: bool,
    pub webhook_configured: bool,
}

#[derive(Serialize)]
pub struct WatcherControlResponse {
    pub success: bool,
    pub message: String,
    pub running: bool,
}

#[derive(Serialize)]
pub struct ChangeHistoryResponse {
    pub success: bool,
    pub message: String,
    pub history: Vec<ChangeHistory>,
}

#[derive(Serialize)]
pub struct RecoveryHistoryResponse {
    pub success: bool,
    pub message: String,
    pub history: Vec<RecoveryHistory>,
}

#[derive(Deserialize)]
pub struct HistoryQuery {
    pub limit: Option<i64>,
}

pub async fn build_baseline(data: web::Data<AppState>) -> HttpResponse {
    let dir = &data.watch_dir;
    if !dir.exists() {
        return HttpResponse::NotFound().json(BaselineResponse {
            success: false,
            message: format!("Directory not found: {}", dir.display()),
            file_count: 0,
            files: vec![],
        });
    }

    let files = hasher::scan_directory(dir);
    let now = chrono::Utc::now().to_rfc3339();
    let mut records = Vec::new();

    for path in &files {
        match hasher::compute_hash(path) {
            Ok(hash) => {
                records.push(FileRecord {
                    path: path.to_string_lossy().to_string(),
                    hash,
                    recorded_at: now.clone(),
                });
            }
            Err(e) => {
                log::warn!("Failed to hash {}: {}", path.display(), e);
            }
        }
    }

    let count = records.len();
    match data.db.replace_baseline(&records) {
        Ok(_) => {
            if data.recovery_manager.is_enabled() {
                for rec in &records {
                    if let Ok(path) = PathBuf::from(&rec.path).canonicalize() {
                        let _ = data.recovery_manager.create_backup(&path, &data.watch_dir);
                    }
                }
            }
            HttpResponse::Ok().json(BaselineResponse {
                success: true,
                message: format!("Baseline established with {} files", count),
                file_count: count,
                files: records,
            })
        }
        Err(e) => HttpResponse::InternalServerError().json(BaselineResponse {
            success: false,
            message: format!("Database error: {}", e),
            file_count: 0,
            files: vec![],
        }),
    }
}

pub async fn verify(data: web::Data<AppState>) -> HttpResponse {
    let start = Instant::now();
    let dir = &data.watch_dir;
    if !dir.exists() {
        return HttpResponse::NotFound().json(VerifyResponse {
            success: false,
            message: format!("Directory not found: {}", dir.display()),
            result: TamperResult {
                modified: vec![],
                deleted: vec![],
                added: vec![],
                is_clean: false,
            },
            auto_recovered: vec![],
            recovery_failed: vec![],
        });
    }

    let files = hasher::scan_directory(dir);
    let mut current = Vec::new();

    for path in &files {
        match hasher::compute_hash(path) {
            Ok(hash) => {
                current.push((path.clone(), hash));
            }
            Err(e) => {
                log::warn!("Failed to hash {}: {}", path.display(), e);
            }
        }
    }

    let result = match data.db.find_tampered(&current) {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::InternalServerError().json(VerifyResponse {
                success: false,
                message: format!("Database error: {}", e),
                result: TamperResult {
                    modified: vec![],
                    deleted: vec![],
                    added: vec![],
                    is_clean: false,
                },
                auto_recovered: vec![],
                recovery_failed: vec![],
            })
        }
    };

    let duration = start.elapsed();
    metrics::record_verify_duration(duration.as_secs_f64());

    let is_clean = result.is_clean;
    let message = if is_clean {
        "All files intact, no tampering detected".to_string()
    } else {
        let mod_count = result.modified.len();
        let del_count = result.deleted.len();
        let add_count = result.added.len();
        format!(
            "Tampering detected: {} modified, {} deleted, {} added",
            mod_count, del_count, add_count
        )
    };

    if !is_clean {
        for _ in &result.modified {
            metrics::record_tamper("modified");
        }
        for _ in &result.deleted {
            metrics::record_tamper("deleted");
        }
        for _ in &result.added {
            metrics::record_tamper("added");
        }

        let alert = WebhookAlert::from_tamper_result(&result, &data.watch_dir.to_string_lossy());
        let webhook_url = data.webhook_url.clone();
        tokio::spawn(async move {
            let _ = send_webhook(&webhook_url, &alert).await;
        });

        let mut recovered = Vec::new();
        let mut failed = Vec::new();

        if data.auto_recover && data.recovery_manager.is_enabled() {
            for tampered in &result.modified {
                let file_path = Path::new(&tampered.path);
                match data.recovery_manager.recover_file(file_path, &data.watch_dir) {
                    Ok(_) => {
                        recovered.push(tampered.path.clone());
                        let _ = data.db.add_recovery_history(
                            &tampered.path,
                            &data.recovery_manager.backup_dir().to_string_lossy(),
                            true,
                            None,
                        );
                        let recovery_alert = RecoveryAlert::new(
                            &tampered.path,
                            &data.recovery_manager.backup_dir().to_string_lossy(),
                            true,
                            None,
                        );
                        let webhook_url = data.webhook_url.clone();
                        tokio::spawn(async move {
                            let _ = send_recovery_webhook(&webhook_url, &recovery_alert).await;
                        });
                    }
                    Err(e) => {
                        failed.push(tampered.path.clone());
                        let _ = data.db.add_recovery_history(
                            &tampered.path,
                            &data.recovery_manager.backup_dir().to_string_lossy(),
                            false,
                            Some(&e),
                        );
                        let recovery_alert = RecoveryAlert::new(
                            &tampered.path,
                            &data.recovery_manager.backup_dir().to_string_lossy(),
                            false,
                            Some(e),
                        );
                        let webhook_url = data.webhook_url.clone();
                        tokio::spawn(async move {
                            let _ = send_recovery_webhook(&webhook_url, &recovery_alert).await;
                        });
                    }
                }
            }

            for deleted_path in &result.deleted {
                let file_path = Path::new(deleted_path);
                match data.recovery_manager.recover_file(file_path, &data.watch_dir) {
                    Ok(_) => {
                        recovered.push(deleted_path.clone());
                        let _ = data.db.add_recovery_history(
                            deleted_path,
                            &data.recovery_manager.backup_dir().to_string_lossy(),
                            true,
                            None,
                        );
                    }
                    Err(e) => {
                        failed.push(deleted_path.clone());
                        let _ = data.db.add_recovery_history(
                            deleted_path,
                            &data.recovery_manager.backup_dir().to_string_lossy(),
                            false,
                            Some(&e),
                        );
                    }
                }
            }
        }

        HttpResponse::Ok().json(VerifyResponse {
            success: true,
            message,
            result,
            auto_recovered: recovered,
            recovery_failed: failed,
        })
    } else {
        HttpResponse::Ok().json(VerifyResponse {
            success: true,
            message,
            result,
            auto_recovered: vec![],
            recovery_failed: vec![],
        })
    }
}

pub async fn status(data: web::Data<AppState>) -> HttpResponse {
    let baseline_count = data
        .db
        .get_baseline()
        .map(|r| r.len())
        .unwrap_or(0);

    HttpResponse::Ok().json(StatusResponse {
        watch_dir: data.watch_dir.to_string_lossy().to_string(),
        backup_dir: if data.recovery_manager.is_enabled() {
            Some(data.recovery_manager.backup_dir().to_string_lossy().to_string())
        } else {
            None
        },
        baseline_count,
        monitored_extensions: hasher::MONITORED_EXTENSIONS
            .iter()
            .map(|s| s.to_string())
            .collect(),
        watcher_running: data.file_watcher.is_running(),
        auto_recover_enabled: data.auto_recover && data.recovery_manager.is_enabled(),
        webhook_configured: !data.webhook_url.is_empty(),
    })
}

pub async fn start_watcher(data: web::Data<AppState>) -> HttpResponse {
    match data.file_watcher.start() {
        Ok(_) => HttpResponse::Ok().json(WatcherControlResponse {
            success: true,
            message: "File watcher started successfully".to_string(),
            running: true,
        }),
        Err(e) => HttpResponse::BadRequest().json(WatcherControlResponse {
            success: false,
            message: format!("Failed to start watcher: {}", e),
            running: data.file_watcher.is_running(),
        }),
    }
}

pub async fn stop_watcher(data: web::Data<AppState>) -> HttpResponse {
    data.file_watcher.stop();
    HttpResponse::Ok().json(WatcherControlResponse {
        success: true,
        message: "File watcher stop signal sent".to_string(),
        running: false,
    })
}

pub async fn get_change_history(data: web::Data<AppState>, query: web::Query<HistoryQuery>) -> HttpResponse {
    let limit = query.limit.unwrap_or(100).clamp(1, 1000);
    
    match data.db.get_change_history(limit) {
        Ok(history) => HttpResponse::Ok().json(ChangeHistoryResponse {
            success: true,
            message: format!("Retrieved {} change records", history.len()),
            history,
        }),
        Err(e) => HttpResponse::InternalServerError().json(ChangeHistoryResponse {
            success: false,
            message: format!("Database error: {}", e),
            history: vec![],
        }),
    }
}

pub async fn get_recovery_history(data: web::Data<AppState>, query: web::Query<HistoryQuery>) -> HttpResponse {
    let limit = query.limit.unwrap_or(100).clamp(1, 1000);
    
    match data.db.get_recovery_history(limit) {
        Ok(history) => HttpResponse::Ok().json(RecoveryHistoryResponse {
            success: true,
            message: format!("Retrieved {} recovery records", history.len()),
            history,
        }),
        Err(e) => HttpResponse::InternalServerError().json(RecoveryHistoryResponse {
            success: false,
            message: format!("Database error: {}", e),
            history: vec![],
        }),
    }
}

pub async fn metrics_handler() -> HttpResponse {
    let metrics_text = metrics::gather_metrics();
    HttpResponse::Ok()
        .content_type("text/plain; version=0.0.4; charset=utf-8")
        .body(metrics_text)
}
