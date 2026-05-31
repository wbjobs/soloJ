mod db;
mod file_watcher;
mod handlers;
mod hasher;
mod metrics;
mod recovery;
mod webhook;

use actix_web::{web, App, HttpServer};
use handlers::AppState;
use std::path::PathBuf;
use std::sync::Arc;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    metrics::init_metrics();

    let args: Vec<String> = std::env::args().collect();

    let watch_dir = args
        .get(1)
        .cloned()
        .unwrap_or_else(|| ".".to_string());
    let watch_dir = PathBuf::from(&watch_dir)
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(&watch_dir));

    let db_path = args
        .get(2)
        .cloned()
        .unwrap_or_else(|| "baseline.db".to_string());

    let backup_dir = args.get(3).cloned();
    let backup_dir = backup_dir.map(|dir| PathBuf::from(&dir));

    let webhook_url = args
        .get(4)
        .cloned()
        .unwrap_or_default();

    let auto_watch = args.iter().any(|arg| arg == "--auto-watch" || arg == "-w");
    let auto_recover = args.iter().any(|arg| arg == "--auto-recover" || arg == "-r");

    let database = db::Database::open(&db_path).expect("Failed to open database");
    let db_arc = Arc::new(database);

    let recovery_manager = backup_dir.map(|dir| Arc::new(recovery::RecoveryManager::new(Some(dir))));
    let recovery_arc = recovery_manager.clone();

    let file_watcher = Arc::new(file_watcher::FileWatcher::new(
        watch_dir.clone(),
        db_arc.clone(),
        recovery_manager,
        webhook_url.clone(),
        auto_recover,
    ));

    let state = web::Data::new(AppState {
        db: db_arc.clone(),
        watch_dir: watch_dir.clone(),
        file_watcher: file_watcher.clone(),
        recovery_manager: recovery_arc
            .clone()
            .unwrap_or_else(|| Arc::new(recovery::RecoveryManager::new(None))),
        webhook_url: webhook_url.clone(),
        auto_recover,
    });

    log::info!("Watching directory: {}", watch_dir.display());
    log::info!("Database: {}", db_path);
    if let Some(rm) = &recovery_arc {
        if rm.is_enabled() {
            log::info!("Backup directory: {}", rm.backup_dir().display());
            log::info!("Auto-recover: {}", if auto_recover { "enabled" } else { "disabled" });
        }
    }
    if !webhook_url.is_empty() {
        log::info!("Webhook URL: {}", webhook_url);
    }
    log::info!("Server starting on http://0.0.0.0:8080");
    log::info!("Prometheus metrics: http://0.0.0.0:8080/metrics");

    if auto_watch {
        if let Err(e) = file_watcher.start() {
            log::warn!("Failed to start auto-watch: {}", e);
        } else {
            log::info!("Auto-watch mode enabled");
        }
    }

    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .route("/api/baseline", web::post().to(handlers::build_baseline))
            .route("/api/verify", web::post().to(handlers::verify))
            .route("/api/status", web::get().to(handlers::status))
            .route("/api/watcher/start", web::post().to(handlers::start_watcher))
            .route("/api/watcher/stop", web::post().to(handlers::stop_watcher))
            .route("/api/history/changes", web::get().to(handlers::get_change_history))
            .route("/api/history/recoveries", web::get().to(handlers::get_recovery_history))
            .route("/metrics", web::get().to(handlers::metrics_handler))
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}
