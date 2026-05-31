#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod docker_client;
mod models;
mod rate_limiter;
mod rules;
mod storage;
mod tls;
mod ws_client;

use std::path::PathBuf;
use std::sync::Arc;

use commands::AppState;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::list_containers,
            commands::get_containers_stats,
            commands::start_analysis,
            commands::stop_analysis,
            commands::get_rate_limiter_stats,
            commands::get_cached_logs_count,
            commands::get_rules,
            commands::update_rules,
        ])
        .setup(|app| {
            let server_url = std::env::var("TAURI_SERVER_URL")
                .unwrap_or_else(|_| "wss://log-ai.example.com/analyze".to_string());

            let accept_invalid_certs = std::env::var("TAURI_ACCEPT_INVALID_CERTS")
                .map(|v| v == "1" || v.to_lowercase() == "true")
                .unwrap_or(true);

            let ca_path = std::env::var("TAURI_CA_CERT")
                .ok()
                .map(PathBuf::from)
                .filter(|p| p.exists());

            let cert_path = std::env::var("TAURI_CLIENT_CERT")
                .ok()
                .map(PathBuf::from)
                .filter(|p| p.exists());

            let key_path = std::env::var("TAURI_CLIENT_KEY")
                .ok()
                .map(PathBuf::from)
                .filter(|p| p.exists());

            let app_data_dir = app.path().app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("."));

            let db_path = app_data_dir.join("log_cache.db");
            let rules_path = app_data_dir.join("rules.yaml");

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let storage = match storage::SharedStorage::new(db_path).await {
                    Ok(s) => {
                        eprintln!("Storage initialized at {}", app_data_dir.join("log_cache.db").display());
                        Some(s)
                    }
                    Err(e) => {
                        eprintln!("Failed to initialize storage: {}", e);
                        None
                    }
                };

                let rule_engine = match rules::RuleEngine::new(rules_path).await {
                    Ok(re) => {
                        eprintln!("Rule engine initialized");
                        Some(Arc::new(re))
                    }
                    Err(e) => {
                        eprintln!("Failed to initialize rule engine: {}", e);
                        None
                    }
                };

                let state = AppState::new(
                    server_url,
                    ca_path.clone(),
                    cert_path.clone(),
                    key_path.clone(),
                    accept_invalid_certs,
                    storage,
                    rule_engine,
                );

                handle.manage(state);

                let docker_client = match docker_client::DockerClient::new().await {
                    Ok(client) => client,
                    Err(e) => {
                        eprintln!("Failed to connect to Docker: {}", e);
                        return;
                    }
                };

                if let Some(state) = handle.try_get::<AppState>() {
                    state.set_docker_client(docker_client).await;
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
