use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use tauri::{Manager, State};
use tokio::sync::broadcast;
use tokio::sync::Mutex;

use crate::docker_client::DockerClient;
use crate::models::{
    AnalysisResult, AppError, ConnectionStatus, Container, ContainerStats, LogMessage,
};
use crate::rate_limiter::LogRateLimiter;
use crate::rules::{RuleConfig, RuleEngine, RuleMatch};
use crate::storage::SharedStorage;
use crate::ws_client::AnalysisSession;

pub struct AppState {
    pub docker_client: Arc<Mutex<Option<DockerClient>>>,
    pub analysis_session: Arc<Mutex<Option<AnalysisSession>>>,
    pub rate_limiter: LogRateLimiter,
    pub server_url: String,
    pub ca_path: Option<PathBuf>,
    pub cert_path: Option<PathBuf>,
    pub key_path: Option<PathBuf>,
    pub accept_invalid_certs: bool,
    pub is_analyzing: Arc<Mutex<bool>>,
    pub storage: Option<SharedStorage>,
    pub rule_engine: Option<Arc<RuleEngine>>,
}

impl AppState {
    pub fn new(
        server_url: String,
        ca_path: Option<PathBuf>,
        cert_path: Option<PathBuf>,
        key_path: Option<PathBuf>,
        accept_invalid_certs: bool,
        storage: Option<SharedStorage>,
        rule_engine: Option<Arc<RuleEngine>>,
    ) -> Self {
        Self {
            docker_client: Arc::new(Mutex::new(None)),
            analysis_session: Arc::new(Mutex::new(None)),
            rate_limiter: LogRateLimiter::new(),
            server_url,
            ca_path,
            cert_path,
            key_path,
            accept_invalid_certs,
            is_analyzing: Arc::new(Mutex::new(false)),
            storage,
            rule_engine,
        }
    }

    pub async fn set_docker_client(&self, client: DockerClient) {
        *self.docker_client.lock().await = Some(client);
    }

    async fn get_docker(&self) -> Result<DockerClient, String> {
        self.docker_client
            .lock()
            .await
            .as_ref()
            .cloned()
            .ok_or_else(|| "Docker client not initialized. Make sure Docker is running.".to_string())
    }
}

#[tauri::command]
pub async fn list_containers(state: State<'_, AppState>) -> Result<Vec<Container>, String> {
    state
        .get_docker()
        .await?
        .list_containers()
        .await
        .map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub async fn get_containers_stats(
    state: State<'_, AppState>,
) -> Result<Vec<ContainerStats>, String> {
    state
        .get_docker()
        .await?
        .get_container_stats()
        .await
        .map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub async fn start_analysis(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    container_id: String,
    container_name: String,
) -> Result<(), String> {
    let docker = state.get_docker().await?;
    let rate_limiter = state.rate_limiter.clone();
    let is_analyzing = state.is_analyzing.clone();
    let storage = state.storage.clone();
    let rule_engine = state.rule_engine.clone();

    let mut analyzing_guard = is_analyzing.lock().await;
    if *analyzing_guard {
        return Err("Analysis already in progress".to_string());
    }

    let mut session_guard = state.analysis_session.lock().await;
    if session_guard.is_some() {
        return Err("Analysis already in progress".to_string());
    }

    let server_url = state.server_url.clone();
    let ca_path = state.ca_path.clone();
    let cert_path = state.cert_path.clone();
    let key_path = state.key_path.clone();
    let accept_invalid_certs = state.accept_invalid_certs;

    rate_limiter.reset().await;

    let session = AnalysisSession::new(
        container_id.clone(),
        container_name.clone(),
        server_url,
        ca_path,
        cert_path,
        key_path,
        accept_invalid_certs,
        storage,
    );

    let (log_tx, log_rx_ws) = broadcast::channel::<LogMessage>(2000);
    let (analysis_tx, mut analysis_rx) = broadcast::channel::<AnalysisResult>(100);
    let (status_tx, mut status_rx) = broadcast::channel::<ConnectionStatus>(10);
    let (rule_match_tx, mut rule_match_rx) = broadcast::channel::<RuleMatch>(100);

    let app_handle_clone = app.clone();
    tokio::spawn(async move {
        loop {
            match analysis_rx.recv().await {
                Ok(result) => {
                    let _ = app_handle_clone.emit("analysis-result", result);
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    let app_handle_clone = app.clone();
    tokio::spawn(async move {
        loop {
            match status_rx.recv().await {
                Ok(status) => {
                    let _ = app_handle_clone.emit("connection-status", status);
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    let app_handle_clone = app.clone();
    tokio::spawn(async move {
        loop {
            match rule_match_rx.recv().await {
                Ok(rule_match) => {
                    let _ = app_handle_clone.emit("rule-match", rule_match);
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    let rate_limiter_clone = rate_limiter.clone();
    let app_handle_clone = app.clone();
    let is_analyzing_clone = is_analyzing.clone();
    tokio::spawn(async move {
        while *is_analyzing_clone.lock().await {
            tokio::time::sleep(Duration::from_millis(50)).await;
            let batch = rate_limiter_clone.drain_ui_batch().await;
            if !batch.is_empty() {
                for log in batch {
                    let _ = app_handle_clone.emit("log-message", log);
                }
            }
        }
    });

    let rate_limiter_clone = rate_limiter.clone();
    let is_analyzing_clone = is_analyzing.clone();
    let log_tx_clone = log_tx.clone();
    tokio::spawn(async move {
        while *is_analyzing_clone.lock().await {
            tokio::time::sleep(Duration::from_millis(25)).await;
            let batch = rate_limiter_clone.drain_ws_batch().await;
            if !batch.is_empty() {
                for log in batch {
                    let _ = log_tx_clone.send(log);
                }
            }
        }
    });

    let rate_limiter_clone = rate_limiter.clone();
    let container_id_clone = container_id.clone();
    let container_name_clone = container_name.clone();
    let is_analyzing_clone = is_analyzing.clone();
    let rule_engine_clone = rule_engine.clone();
    let rule_match_tx_clone = rule_match_tx.clone();
    let app_handle_notify = app.clone();
    tokio::spawn(async move {
        let sender = RateLimitedSender {
            rate_limiter: rate_limiter_clone,
            is_analyzing: is_analyzing_clone.clone(),
            container_id: container_id_clone.clone(),
            container_name: container_name_clone.clone(),
            rule_engine: rule_engine_clone,
            rule_match_tx: rule_match_tx_clone.clone(),
            app_handle: app_handle_notify,
        };
        let _ = docker
            .stream_logs(&container_id_clone, sender, true)
            .await;
    });

    let log_rx_ws = LogReceiver { rx: log_rx_ws };
    let analysis_tx_sender = BroadcastSender { tx: analysis_tx };
    let status_tx_sender = BroadcastSender { tx: status_tx };

    session
        .start(log_rx_ws, analysis_tx_sender, status_tx_sender)
        .await
        .map_err(|e: AppError| e.to_string())?;

    *analyzing_guard = true;
    *session_guard = Some(session);

    Ok(())
}

#[tauri::command]
pub async fn stop_analysis(state: State<'_, AppState>) -> Result<(), String> {
    let mut analyzing_guard = state.is_analyzing.lock().await;
    *analyzing_guard = false;

    let mut session_guard = state.analysis_session.lock().await;
    if let Some(session) = session_guard.take() {
        session.stop().await;
    }

    state.rate_limiter.reset().await;

    Ok(())
}

#[tauri::command]
pub async fn get_rate_limiter_stats(
    state: State<'_, AppState>,
) -> Result<crate::rate_limiter::RateLimiterStats, String> {
    Ok(state.rate_limiter.get_stats().await)
}

#[tauri::command]
pub async fn get_cached_logs_count(state: State<'_, AppState>) -> Result<i64, String> {
    if let Some(storage) = &state.storage {
        storage
            .get_unsent_count()
            .await
            .map_err(|e: AppError| e.to_string())
    } else {
        Ok(0)
    }
}

#[tauri::command]
pub async fn get_rules(state: State<'_, AppState>) -> Result<RuleConfig, String> {
    if let Some(rule_engine) = &state.rule_engine {
        Ok(rule_engine.get_rules().await)
    } else {
        Ok(RuleConfig { rules: vec![] })
    }
}

#[tauri::command]
pub async fn update_rules(state: State<'_, AppState>, rules: RuleConfig) -> Result<(), String> {
    if let Some(rule_engine) = &state.rule_engine {
        rule_engine
            .update_rules(rules)
            .await
            .map_err(|e: AppError| e.to_string())
    } else {
        Err("Rule engine not initialized".to_string())
    }
}

pub struct RateLimitedSender {
    rate_limiter: LogRateLimiter,
    is_analyzing: Arc<Mutex<bool>>,
    container_id: String,
    container_name: String,
    rule_engine: Option<Arc<RuleEngine>>,
    rule_match_tx: broadcast::Sender<RuleMatch>,
    app_handle: tauri::AppHandle,
}

#[async_trait::async_trait]
impl crate::docker_client::LogSender for RateLimitedSender {
    async fn send(&self, msg: LogMessage) -> Result<(), ()> {
        if !*self.is_analyzing.lock().await {
            return Err(());
        }

        if let Some(rule_engine) = &self.rule_engine {
            let matches = rule_engine.check_log(&msg).await;
            for rule_match in matches {
                if rule_engine.should_notify(&rule_match.level).await {
                    let title = format!("[{}] {}", rule_match.level.to_uppercase(), rule_match.rule_name);
                    let message = format!("Keyword: '{}'\n{}", rule_match.keyword, rule_match.content);
                    RuleEngine::send_system_notification(&title, &message);
                }
                let _ = self.rule_match_tx.send(rule_match);
            }
        }

        self.rate_limiter.submit(msg).await;
        Ok(())
    }
}

pub struct LogReceiver {
    rx: broadcast::Receiver<LogMessage>,
}

#[async_trait::async_trait]
impl crate::ws_client::LogReceiver for LogReceiver {
    async fn recv(&mut self) -> Option<LogMessage> {
        loop {
            match self.rx.recv().await {
                Ok(msg) => return Some(msg),
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => return None,
            }
        }
    }
}

pub struct BroadcastSender<T: Clone + Send + 'static> {
    tx: broadcast::Sender<T>,
}

#[async_trait::async_trait]
impl<T: Clone + Send + 'static> crate::ws_client::MessageSender<T> for BroadcastSender<T> {
    async fn send(&self, msg: T) -> Result<(), ()> {
        self.tx.send(msg).map(|_| ()).map_err(|_| ())
    }
}
