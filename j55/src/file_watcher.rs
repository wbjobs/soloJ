use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::mpsc;

use crate::db::Database;
use crate::hasher;
use crate::metrics;
use crate::recovery::RecoveryManager;
use crate::webhook::{send_recovery_webhook, send_webhook, RecoveryAlert, WebhookAlert};

const DEBOUNCE_MS: u64 = 500;
const CLEANUP_INTERVAL_MS: u64 = 1000;

#[derive(Debug, Clone)]
pub struct FileChange {
    pub path: PathBuf,
    pub kind: String,
    pub timestamp: Instant,
}

pub struct FileWatcher {
    watch_dir: PathBuf,
    db: Arc<Database>,
    recovery_manager: Option<Arc<RecoveryManager>>,
    webhook_url: String,
    auto_recover: bool,
    is_running: Arc<AtomicBool>,
    pending_changes: Arc<Mutex<HashMap<PathBuf, FileChange>>>,
    watched_paths: Arc<Mutex<HashSet<PathBuf>>>,
}

impl FileWatcher {
    pub fn new(
        watch_dir: PathBuf,
        db: Arc<Database>,
        recovery_manager: Option<Arc<RecoveryManager>>,
        webhook_url: String,
        auto_recover: bool,
    ) -> Self {
        Self {
            watch_dir,
            db,
            recovery_manager,
            webhook_url,
            auto_recover,
            is_running: Arc::new(AtomicBool::new(false)),
            pending_changes: Arc::new(Mutex::new(HashMap::new())),
            watched_paths: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    pub fn start(&self) -> Result<(), String> {
        if self.is_running.load(Ordering::SeqCst) {
            return Err("Watcher is already running".to_string());
        }

        let watch_dir = self.watch_dir.clone();
        let db = self.db.clone();
        let recovery_manager = self.recovery_manager.clone();
        let webhook_url = self.webhook_url.clone();
        let auto_recover = self.auto_recover;
        let is_running = self.is_running.clone();
        let pending_changes = self.pending_changes.clone();
        let watched_paths = self.watched_paths.clone();

        is_running.store(true, Ordering::SeqCst);

        std::thread::spawn(move || {
            if let Err(e) = Self::run_watcher(
                watch_dir,
                db,
                recovery_manager,
                webhook_url,
                auto_recover,
                is_running.clone(),
                pending_changes,
                watched_paths,
            ) {
                log::error!("File watcher error: {}", e);
            }
            is_running.store(false, Ordering::SeqCst);
        });

        Ok(())
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }

    #[allow(clippy::too_many_arguments)]
    fn run_watcher(
        watch_dir: PathBuf,
        db: Arc<Database>,
        recovery_manager: Option<Arc<RecoveryManager>>,
        webhook_url: String,
        auto_recover: bool,
        is_running: Arc<AtomicBool>,
        pending_changes: Arc<Mutex<HashMap<PathBuf, FileChange>>>,
        watched_paths: Arc<Mutex<HashSet<PathBuf>>>,
    ) -> Result<(), String> {
        let (tx, mut rx) = mpsc::unbounded_channel();

        let mut watcher: RecommendedWatcher = Watcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    let _ = tx.send(event);
                }
            },
            notify::Config::default(),
        ).map_err(|e| e.to_string())?;

        watcher
            .watch(&watch_dir, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch directory: {}", e))?;

        log::info!("Started watching directory: {}", watch_dir.display());

        let runtime = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;

        runtime.block_on(async {
            let mut cleanup_interval = tokio::time::interval(Duration::from_millis(CLEANUP_INTERVAL_MS));

            while is_running.load(Ordering::SeqCst) {
                tokio::select! {
                    Some(event) = rx.recv() => {
                        Self::handle_event(event, &pending_changes, &watched_paths, &watch_dir);
                    }
                    _ = cleanup_interval.tick() => {
                        Self::process_pending_changes(
                            &pending_changes,
                            &db,
                            &recovery_manager,
                            &webhook_url,
                            auto_recover,
                            &watch_dir,
                        ).await;
                    }
                }
            }
        });

        log::info!("File watcher stopped");
        Ok(())
    }

    fn handle_event(
        event: Event,
        pending_changes: &Mutex<HashMap<PathBuf, FileChange>>,
        watched_paths: &Mutex<HashSet<PathBuf>>,
        watch_dir: &Path,
    ) {
        for path in &event.paths {
            if !hasher::is_monitored(path) {
                continue;
            }

            let rel_path = match path.strip_prefix(watch_dir) {
                Ok(p) => p.to_path_buf(),
                Err(_) => path.clone(),
            };

            let kind = match event.kind {
                EventKind::Create(_) => "created".to_string(),
                EventKind::Modify(_) => "modified".to_string(),
                EventKind::Remove(_) => "deleted".to_string(),
                _ => continue,
            };

            let mut pending = pending_changes.lock().unwrap();
            pending.insert(
                path.clone(),
                FileChange {
                    path: rel_path,
                    kind,
                    timestamp: Instant::now(),
                },
            );

            if matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_)) {
                let mut watched = watched_paths.lock().unwrap();
                watched.insert(path.clone());
            }
        }
    }

    async fn process_pending_changes(
        pending_changes: &Mutex<HashMap<PathBuf, FileChange>>,
        db: &Arc<Database>,
        recovery_manager: &Option<Arc<RecoveryManager>>,
        webhook_url: &str,
        auto_recover: bool,
        watch_dir: &Path,
    ) {
        let now = Instant::now();
        let debounce = Duration::from_millis(DEBOUNCE_MS);
        let mut to_process: Vec<(PathBuf, FileChange)> = Vec::new();

        {
            let mut pending = pending_changes.lock().unwrap();
            pending.retain(|full_path, change| {
                if now.duration_since(change.timestamp) >= debounce {
                    to_process.push((full_path.clone(), change.clone()));
                    false
                } else {
                    true
                }
            });
        }

        for (full_path, change) in to_process {
            Self::process_single_change(
                &full_path,
                &change,
                db,
                recovery_manager,
                webhook_url,
                auto_recover,
                watch_dir,
            ).await;
        }
    }

    async fn process_single_change(
        full_path: &Path,
        change: &FileChange,
        db: &Arc<Database>,
        recovery_manager: &Option<Arc<RecoveryManager>>,
        webhook_url: &str,
        auto_recover: bool,
        watch_dir: &Path,
    ) {
        let path_str = full_path.to_string_lossy().to_string();
        
        match change.kind.as_str() {
            "created" | "modified" => {
                if full_path.exists() {
                    match hasher::compute_hash(full_path) {
                        Ok(new_hash) => {
                            let baseline = db.get_baseline().unwrap_or_default();
                            let old_hash = baseline.iter()
                                .find(|r| r.path == path_str)
                                .map(|r| r.hash.clone());

                            let is_tampered = match &old_hash {
                                Some(old) => old != &new_hash,
                                None => true,
                            };

                            if is_tampered && old_hash.is_some() {
                                metrics::record_tamper("modified");

                                if auto_recover {
                                    if let Some(rm) = recovery_manager {
                                        match rm.recover_file(full_path, watch_dir) {
                                            Ok(_) => {
                                                log::info!(
                                                    "Auto-recovered modified file: {}",
                                                    path_str
                                                );
                                                let _ = db.add_recovery_history(
                                                    &path_str,
                                                    &rm.backup_dir().to_string_lossy(),
                                                    true,
                                                    None,
                                                );
                                                let alert = RecoveryAlert::new(
                                                    &path_str,
                                                    &rm.backup_dir().to_string_lossy(),
                                                    true,
                                                    None,
                                                );
                                                let webhook_url = webhook_url.to_string();
                                                tokio::spawn(async move {
                                                    let _ = send_recovery_webhook(&webhook_url, &alert).await;
                                                });
                                                return;
                                            }
                                            Err(e) => {
                                                log::warn!(
                                                    "Failed to auto-recover {}: {}",
                                                    path_str, e
                                                );
                                                let _ = db.add_recovery_history(
                                                    &path_str,
                                                    &rm.backup_dir().to_string_lossy(),
                                                    false,
                                                    Some(&e),
                                                );
                                                let alert = RecoveryAlert::new(
                                                    &path_str,
                                                    &rm.backup_dir().to_string_lossy(),
                                                    false,
                                                    Some(e),
                                                );
                                                let webhook_url = webhook_url.to_string();
                                                tokio::spawn(async move {
                                                    let _ = send_recovery_webhook(&webhook_url, &alert).await;
                                                });
                                            }
                                        }
                                    }
                                }

                                if !webhook_url.is_empty() {
                                    use crate::db::{TamperResult, TamperedFile};
                                    let result = TamperResult {
                                        modified: vec![TamperedFile {
                                            path: path_str.clone(),
                                            baseline_hash: old_hash.clone().unwrap_or_default(),
                                            current_hash: new_hash.clone(),
                                        }],
                                        deleted: vec![],
                                        added: vec![],
                                        is_clean: false,
                                    };
                                    let alert = WebhookAlert::from_tamper_result(
                                        &result,
                                        &watch_dir.to_string_lossy(),
                                    );
                                    let webhook_url = webhook_url.to_string();
                                    tokio::spawn(async move {
                                        let _ = send_webhook(&webhook_url, &alert).await;
                                    });
                                }
                            }

                            let recorded_at = chrono::Utc::now().to_rfc3339();
                            let change_type = if old_hash.is_some() { "modified" } else { "created" };
                            
                            if let Err(e) = db.update_file_hash(&path_str, &new_hash, &recorded_at) {
                                log::warn!("Failed to update baseline for {}: {}", path_str, e);
                            }
                            
                            if let Err(e) = db.add_change_history(
                                &path_str,
                                change_type,
                                old_hash.as_deref(),
                                Some(&new_hash),
                            ) {
                                log::warn!("Failed to record change history for {}: {}", path_str, e);
                            }

                            log::info!(
                                "File {}: {} (hash: {})",
                                change_type,
                                path_str.strip_prefix(watch_dir.to_string_lossy().as_ref()).unwrap_or(&path_str),
                                &new_hash[..16]
                            );
                        }
                        Err(e) => {
                            log::warn!("Failed to compute hash for {}: {}", path_str, e);
                        }
                    }
                }
            }
            "deleted" => {
                let baseline = db.get_baseline().unwrap_or_default();
                let old_hash = baseline.iter()
                    .find(|r| r.path == path_str)
                    .map(|r| r.hash.clone());

                if old_hash.is_some() {
                    metrics::record_tamper("deleted");

                    if auto_recover {
                        if let Some(rm) = recovery_manager {
                            match rm.recover_file(full_path, watch_dir) {
                                Ok(_) => {
                                    log::info!(
                                        "Auto-recovered deleted file: {}",
                                        path_str
                                    );
                                    let _ = db.add_recovery_history(
                                        &path_str,
                                        &rm.backup_dir().to_string_lossy(),
                                        true,
                                        None,
                                    );
                                    let alert = RecoveryAlert::new(
                                        &path_str,
                                        &rm.backup_dir().to_string_lossy(),
                                        true,
                                        None,
                                    );
                                    let webhook_url = webhook_url.to_string();
                                    tokio::spawn(async move {
                                        let _ = send_recovery_webhook(&webhook_url, &alert).await;
                                    });
                                    return;
                                }
                                Err(e) => {
                                    log::warn!(
                                        "Failed to auto-recover deleted file {}: {}",
                                        path_str, e
                                    );
                                    let _ = db.add_recovery_history(
                                        &path_str,
                                        &rm.backup_dir().to_string_lossy(),
                                        false,
                                        Some(&e),
                                    );
                                    let alert = RecoveryAlert::new(
                                        &path_str,
                                        &rm.backup_dir().to_string_lossy(),
                                        false,
                                        Some(e),
                                    );
                                    let webhook_url = webhook_url.to_string();
                                    tokio::spawn(async move {
                                        let _ = send_recovery_webhook(&webhook_url, &alert).await;
                                    });
                                }
                            }
                        }
                    }

                    if !webhook_url.is_empty() {
                        use crate::db::TamperResult;
                        let result = TamperResult {
                            modified: vec![],
                            deleted: vec![path_str.clone()],
                            added: vec![],
                            is_clean: false,
                        };
                        let alert = WebhookAlert::from_tamper_result(
                            &result,
                            &watch_dir.to_string_lossy(),
                        );
                        let webhook_url = webhook_url.to_string();
                        tokio::spawn(async move {
                            let _ = send_webhook(&webhook_url, &alert).await;
                        });
                    }

                    if let Err(e) = db.remove_file_from_baseline(&path_str) {
                        log::warn!("Failed to remove from baseline {}: {}", path_str, e);
                    }
                    
                    if let Err(e) = db.add_change_history(
                        &path_str,
                        "deleted",
                        old_hash.as_deref(),
                        None,
                    ) {
                        log::warn!("Failed to record change history for {}: {}", path_str, e);
                    }

                    log::info!(
                        "File deleted: {}",
                        path_str.strip_prefix(watch_dir.to_string_lossy().as_ref()).unwrap_or(&path_str)
                    );
                }
            }
            _ => {}
        }
    }
}
