use thiserror::Error;

#[derive(Error, Debug)]
pub enum GatewayError {
    #[error("Modbus error: {0}")]
    Modbus(String),

    #[error("Modbus client error: {0}")]
    ModbusClient(String),

    #[error("HTTP request error: {0}")]
    HttpRequest(#[from] reqwest::Error),

    #[error("Ring buffer full")]
    BufferFull,

    #[error("Ring buffer empty")]
    BufferEmpty,

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Channel error: {0}")]
    Channel(String),

    #[error("Other error: {0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, GatewayError>;
