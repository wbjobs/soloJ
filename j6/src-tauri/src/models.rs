use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Container {
    pub id: String,
    pub name: String,
    pub status: String,
    pub state: String,
    pub image: String,
    pub created: i64,
    #[serde(default)]
    pub cpu_usage: f64,
    #[serde(default)]
    pub memory_usage: f64,
    #[serde(default)]
    pub memory_usage_bytes: u64,
    #[serde(default)]
    pub memory_limit_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerStats {
    pub id: String,
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub memory_usage_bytes: u64,
    pub memory_limit_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub level: String,
    pub message: String,
    pub timestamp: i64,
    #[serde(default)]
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogMessage {
    pub stream: String,
    pub content: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionStatus {
    pub status: String,
    #[serde(default)]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisStartRequest {
    pub container_id: String,
    pub container_name: String,
}

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Docker API error: {0}")]
    DockerError(String),
    #[error("WebSocket error: {0}")]
    WebSocketError(String),
    #[error("TLS error: {0}")]
    TlsError(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),
    #[error("Other error: {0}")]
    Other(String),
}

impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}

impl From<bollard::errors::Error> for AppError {
    fn from(err: bollard::errors::Error) -> Self {
        AppError::DockerError(err.to_string())
    }
}

impl From<tokio_tungstenite::tungstenite::Error> for AppError {
    fn from(err: tokio_tungstenite::tungstenite::Error) -> Self {
        AppError::WebSocketError(err.to_string())
    }
}

impl From<rustls::Error> for AppError {
    fn from(err: rustls::Error) -> Self {
        AppError::TlsError(err.to_string())
    }
}
