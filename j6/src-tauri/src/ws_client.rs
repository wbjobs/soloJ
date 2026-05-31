use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio_tungstenite::{
    connect_async_tls_with_config, tungstenite::protocol::Message, Connector, MaybeTlsStream,
    WebSocketStream,
};
use url::Url;

use crate::models::{AnalysisResult, AppError, ConnectionStatus, LogMessage};
use crate::storage::SharedStorage;

#[async_trait]
pub trait LogReceiver: Send {
    async fn recv(&mut self) -> Option<LogMessage>;
}

#[async_trait]
pub trait MessageSender<T: Send>: Send + Sync {
    async fn send(&self, msg: T) -> Result<(), ()>;
}

pub struct WebSocketClient {
    ws_stream: Option<WebSocketStream<MaybeTlsStream<TcpStream>>>,
    server_url: String,
    ca_path: Option<std::path::PathBuf>,
    cert_path: Option<std::path::PathBuf>,
    key_path: Option<std::path::PathBuf>,
    accept_invalid_certs: bool,
}

impl WebSocketClient {
    pub fn new(
        server_url: String,
        ca_path: Option<std::path::PathBuf>,
        cert_path: Option<std::path::PathBuf>,
        key_path: Option<std::path::PathBuf>,
        accept_invalid_certs: bool,
    ) -> Self {
        Self {
            ws_stream: None,
            server_url,
            ca_path,
            cert_path,
            key_path,
            accept_invalid_certs,
        }
    }

    pub async fn connect(&mut self) -> Result<(), AppError> {
        let url = Url::parse(&self.server_url)
            .map_err(|e| AppError::WebSocketError(format!("Invalid URL: {}", e)))?;

        let domain = url
            .host_str()
            .ok_or_else(|| AppError::WebSocketError("No host in URL".to_string()))?;

        let connector = if self.accept_invalid_certs {
            let tls_connector = crate::tls::TlsConfig::connect_dangerous()?;
            Some(Connector::Rustls(tls_connector, domain.to_string()))
        } else if self.ca_path.is_some() || self.cert_path.is_some() {
            let tls_config = crate::tls::TlsConfig::new(
                self.ca_path.clone(),
                self.cert_path.clone(),
                self.key_path.clone(),
            )?;
            Some(Connector::Rustls(
                tls_config.connector(),
                domain.to_string(),
            ))
        } else {
            None
        };

        let (ws_stream, _response) =
            connect_async_tls_with_config(&self.server_url, None, false, connector)
                .await
                .map_err(|e| AppError::WebSocketError(format!("Connect failed: {}", e)))?;

        self.ws_stream = Some(ws_stream);
        Ok(())
    }

    pub async fn send_log(&mut self, log: &LogMessage) -> Result<(), AppError> {
        let ws_stream = self
            .ws_stream
            .as_mut()
            .ok_or_else(|| AppError::WebSocketError("Not connected".to_string()))?;

        let json_msg = serde_json::to_string(log)?;
        ws_stream
            .send(Message::Text(json_msg))
            .await
            .map_err(AppError::from)
    }

    pub async fn send_log_batch(&mut self, logs: &[LogMessage]) -> Result<(), AppError> {
        if logs.is_empty() {
            return Ok(());
        }

        let ws_stream = self
            .ws_stream
            .as_mut()
            .ok_or_else(|| AppError::WebSocketError("Not connected".to_string()))?;

        for log in logs {
            let json_msg = serde_json::to_string(log)?;
            ws_stream
                .send(Message::Text(json_msg))
                .await
                .map_err(AppError::from)?;
        }

        Ok(())
    }

    pub async fn send_init(&mut self, container_id: &str, container_name: &str) -> Result<(), AppError> {
        let ws_stream = self
            .ws_stream
            .as_mut()
            .ok_or_else(|| AppError::WebSocketError("Not connected".to_string()))?;

        let init_msg = serde_json::json!({
            "type": "init",
            "container_id": container_id,
            "container_name": container_name,
            "timestamp": chrono::Utc::now().timestamp_millis()
        });

        ws_stream
            .send(Message::Text(init_msg.to_string()))
            .await
            .map_err(AppError::from)
    }

    pub async fn receive(&mut self) -> Result<Option<AnalysisResult>, AppError> {
        let ws_stream = self
            .ws_stream
            .as_mut()
            .ok_or_else(|| AppError::WebSocketError("Not connected".to_string()))?;

        match ws_stream.next().await {
            Some(Ok(message)) => match message {
                Message::Text(text) => {
                    let result: serde_json::Result<AnalysisResult> = serde_json::from_str(&text);
                    match result {
                        Ok(analysis) => Ok(Some(analysis)),
                        Err(e) => {
                            eprintln!("Failed to parse analysis result: {}", e);
                            Ok(None)
                        }
                    }
                }
                Message::Binary(_) => Ok(None),
                Message::Close(_) => Err(AppError::WebSocketError(
                    "Connection closed by server".to_string(),
                )),
                _ => Ok(None),
            },
            Some(Err(e)) => Err(AppError::from(e)),
            None => Err(AppError::WebSocketError(
                "WebSocket stream ended".to_string(),
            )),
        }
    }

    pub async fn close(&mut self) -> Result<(), AppError> {
        if let Some(ws_stream) = self.ws_stream.as_mut() {
            let _ = ws_stream.close(None).await;
        }
        self.ws_stream = None;
        Ok(())
    }

    pub fn is_connected(&self) -> bool {
        self.ws_stream.is_some()
    }
}

pub struct AnalysisSession {
    container_id: String,
    container_name: String,
    ws_client: Arc<Mutex<WebSocketClient>>,
    is_running: Arc<Mutex<bool>>,
    is_connected: Arc<Mutex<bool>>,
    storage: Option<SharedStorage>,
}

impl AnalysisSession {
    pub fn new(
        container_id: String,
        container_name: String,
        server_url: String,
        ca_path: Option<std::path::PathBuf>,
        cert_path: Option<std::path::PathBuf>,
        key_path: Option<std::path::PathBuf>,
        accept_invalid_certs: bool,
        storage: Option<SharedStorage>,
    ) -> Self {
        let ws_client = WebSocketClient::new(
            server_url,
            ca_path,
            cert_path,
            key_path,
            accept_invalid_certs,
        );

        Self {
            container_id,
            container_name,
            ws_client: Arc::new(Mutex::new(ws_client)),
            is_running: Arc::new(Mutex::new(false)),
            is_connected: Arc::new(Mutex::new(false)),
            storage,
        }
    }

    pub async fn start(
        &self,
        log_rx: impl LogReceiver + 'static,
        analysis_tx: impl MessageSender<AnalysisResult> + 'static,
        status_tx: impl MessageSender<ConnectionStatus> + 'static,
    ) -> Result<(), AppError> {
        *self.is_running.lock().await = true;

        let container_id = self.container_id.clone();
        let container_name = self.container_name.clone();
        let ws_client = self.ws_client.clone();
        let is_running = self.is_running.clone();
        let is_connected = self.is_connected.clone();
        let storage = self.storage.clone();

        let log_rx_box: Box<dyn LogReceiver + Send> = Box::new(log_rx);
        let analysis_tx_arc: Arc<dyn MessageSender<AnalysisResult> + Send + Sync> = Arc::new(analysis_tx);
        let status_tx_arc: Arc<dyn MessageSender<ConnectionStatus> + Send + Sync> = Arc::new(status_tx);
        let status_tx_for_err = status_tx_arc.clone();

        tokio::spawn(async move {
            let result = Self::run_analysis(
                container_id,
                container_name,
                ws_client,
                log_rx_box,
                analysis_tx_arc,
                status_tx_arc.clone(),
                is_running,
                is_connected,
                storage,
            )
            .await;

            if let Err(e) = result {
                let _ = status_tx_for_err
                    .send(ConnectionStatus {
                        status: "error".to_string(),
                        message: Some(e.to_string()),
                    })
                    .await;
            }
        });

        Ok(())
    }

    async fn run_analysis(
        container_id: String,
        container_name: String,
        ws_client: Arc<Mutex<WebSocketClient>>,
        mut log_rx: Box<dyn LogReceiver + Send>,
        analysis_tx: Arc<dyn MessageSender<AnalysisResult> + Send + Sync>,
        status_tx: Arc<dyn MessageSender<ConnectionStatus> + Send + Sync>,
        is_running: Arc<Mutex<bool>>,
        is_connected: Arc<Mutex<bool>>,
        storage: Option<SharedStorage>,
    ) -> Result<(), AppError> {
        let _ = status_tx
            .send(ConnectionStatus {
                status: "connecting".to_string(),
                message: None,
            })
            .await;

        for attempt in 1..=3 {
            {
                let mut client = ws_client.lock().await;
                match client.connect().await {
                    Ok(_) => {
                        let _ = client.send_init(&container_id, &container_name).await;
                        *is_connected.lock().await = true;
                        break;
                    }
                    Err(e) => {
                        if attempt == 3 {
                            *is_connected.lock().await = false;
                            let _ = status_tx
                                .send(ConnectionStatus {
                                    status: "offline".to_string(),
                                    message: Some(format!("Connection failed: {}, running in offline mode", e)),
                                })
                                .await;
                        }
                        tokio::time::sleep(Duration::from_secs(attempt * 2)).await;
                    }
                }
            }
        }

        if *is_connected.lock().await {
            let _ = status_tx
                .send(ConnectionStatus {
                    status: "connected".to_string(),
                    message: None,
                })
                .await;
        }

        let ws_client_clone = ws_client.clone();
        let is_running_clone = is_running.clone();
        let status_tx_clone = status_tx.clone();
        let is_connected_clone = is_connected.clone();

        tokio::spawn(async move {
            while *is_running_clone.lock().await {
                let mut client = ws_client_clone.lock().await;
                match client.receive().await {
                    Ok(Some(analysis)) => {
                        let _ = analysis_tx.send(analysis).await;
                    }
                    Ok(None) => {
                        tokio::time::sleep(Duration::from_millis(100)).await;
                    }
                    Err(e) => {
                        eprintln!("WebSocket receive error: {}", e);
                        *is_connected_clone.lock().await = false;
                        let _ = status_tx_clone
                            .send(ConnectionStatus {
                                status: "offline".to_string(),
                                message: Some(format!("Disconnected: {}, caching logs locally", e)),
                            })
                            .await;
                        tokio::time::sleep(Duration::from_secs(2)).await;
                        if Self::reconnect(&ws_client_clone, &container_id, &container_name).await {
                            *is_connected_clone.lock().await = true;
                            let _ = status_tx_clone
                                .send(ConnectionStatus {
                                    status: "connected".to_string(),
                                    message: Some("Reconnected successfully".to_string()),
                                })
                                .await;
                        }
                    }
                }
            }
        });

        let storage_clone = storage.clone();
        let container_id_clone = container_id.clone();
        let container_name_clone = container_name.clone();
        let is_connected_for_cache = is_connected.clone();
        let ws_client_for_resend = ws_client.clone();
        let status_tx_for_resend = status_tx.clone();
        let is_running_for_resend = is_running.clone();

        tokio::spawn(async move {
            let mut last_resend_check = tokio::time::Instant::now();
            let resend_interval = Duration::from_secs(5);

            loop {
                if !*is_running_for_resend.lock().await {
                    break;
                }

                if *is_connected_for_cache.lock().await {
                    let now = tokio::time::Instant::now();
                    if now - last_resend_check >= resend_interval {
                        if let Some(storage) = &storage_clone {
                            if let Ok(unsent_logs) = storage.get_unsent_logs(100).await {
                                if !unsent_logs.is_empty() {
                                    let logs: Vec<LogMessage> = unsent_logs
                                        .iter()
                                        .map(|l| LogMessage {
                                            stream: l.stream.clone(),
                                            content: l.content.clone(),
                                            timestamp: l.timestamp,
                                        })
                                        .collect();
                                    let ids: Vec<i64> = unsent_logs.iter().map(|l| l.id).collect();

                                    let mut client = ws_client_for_resend.lock().await;
                                    if client.send_log_batch(&logs).await.is_ok() {
                                        let _ = storage.mark_as_sent(&ids).await;
                                        let _ = status_tx_for_resend
                                            .send(ConnectionStatus {
                                                status: "resending".to_string(),
                                                message: Some(format!("Re-sent {} cached logs", logs.len())),
                                            })
                                            .await;
                                    }
                                }
                            }
                        }
                        last_resend_check = now;
                    }
                }

                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        });

        const MAX_BATCH_SIZE: usize = 50;
        const BATCH_TIMEOUT_MS: u64 = 25;

        while *is_running.lock().await {
            let mut batch = Vec::with_capacity(MAX_BATCH_SIZE);
            let batch_deadline = tokio::time::Instant::now()
                .checked_add(tokio::time::Duration::from_millis(BATCH_TIMEOUT_MS))
                .unwrap();

            loop {
                tokio::select! {
                    biased;

                    Some(log_msg) = log_rx.recv() => {
                        batch.push(log_msg);
                        if batch.len() >= MAX_BATCH_SIZE {
                            break;
                        }
                    }

                    _ = tokio::time::sleep_until(batch_deadline) => {
                        break;
                    }

                    else => {
                        break;
                    }
                }
            }

            if batch.is_empty() {
                if !*is_running.lock().await {
                    break;
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                continue;
            }

            if *is_connected.lock().await {
                let mut client = ws_client.lock().await;
                if let Err(e) = client.send_log_batch(&batch).await {
                    drop(client);
                    eprintln!("Failed to send log batch ({} items): {}", batch.len(), e);
                    *is_connected.lock().await = false;
                    let _ = status_tx
                        .send(ConnectionStatus {
                            status: "offline".to_string(),
                            message: Some(format!("Send failed: {}, caching logs", e)),
                        })
                        .await;

                    if let Some(storage) = &storage {
                        for log in &batch {
                            let _ = storage.insert_log(&container_id, &container_name, log).await;
                        }
                    }
                }
            } else if let Some(storage) = &storage {
                for log in &batch {
                    let _ = storage.insert_log(&container_id, &container_name, log).await;
                }
                let _ = status_tx
                    .send(ConnectionStatus {
                        status: "caching".to_string(),
                        message: Some(format!("Cached {} logs locally", batch.len())),
                    })
                    .await;
            }
        }

        let mut client = ws_client.lock().await;
        let _ = client.close().await;
        *is_connected.lock().await = false;

        *is_running.lock().await = false;

        let _ = status_tx
            .send(ConnectionStatus {
                status: "disconnected".to_string(),
                message: None,
            })
            .await;

        Ok(())
    }

    async fn reconnect(
        ws_client: &Arc<Mutex<WebSocketClient>>,
        container_id: &str,
        container_name: &str,
    ) -> bool {
        for attempt in 1..=3 {
            eprintln!("Reconnection attempt {}", attempt);
            tokio::time::sleep(Duration::from_secs(attempt * 2)).await;

            let mut client = ws_client.lock().await;
            if client.connect().await.is_ok() && client.send_init(container_id, container_name).await.is_ok() {
                eprintln!("Reconnected successfully");
                return true;
            }
        }
        false
    }

    pub async fn stop(&self) {
        *self.is_running.lock().await = false;
        let mut client = self.ws_client.lock().await;
        let _ = client.close().await;
    }
}
