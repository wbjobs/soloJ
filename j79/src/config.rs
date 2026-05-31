use crate::crypto::CryptoConfig;
use crate::data_pusher::DataPusherConfig;
use crate::error::{GatewayError, Result};
use crate::modbus_poller::ModbusConfig;
use crate::ring_buffer::OverflowStrategy;
use serde::Deserialize;
use std::fs;

#[derive(Debug, Clone, Deserialize)]
pub struct GatewayConfig {
    pub gateway_id: String,
    pub buffer_capacity: usize,
    #[serde(default)]
    pub buffer_overflow_strategy: OverflowStrategy,
    pub stats_interval_secs: u64,
    pub modbus: Vec<ModbusConfig>,
    pub data_pusher: DataPusherConfig,
    #[serde(default)]
    pub crypto: CryptoConfig,
    pub metrics: MetricsConfig,
    pub log_level: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MetricsConfig {
    pub enabled: bool,
    pub host: String,
    pub port: u16,
}

impl Default for MetricsConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            host: "0.0.0.0".to_string(),
            port: 9090,
        }
    }
}

impl GatewayConfig {
    pub fn load(path: &str) -> Result<Self> {
        let content = fs::read_to_string(path)
            .map_err(|e| GatewayError::Config(format!("Failed to read config file: {}", e)))?;

        let config: GatewayConfig = toml::from_str(&content)
            .map_err(|e| GatewayError::Config(format!("Failed to parse config: {}", e)))?;

        config.validate()?;

        Ok(config)
    }

    fn validate(&self) -> Result<()> {
        if self.gateway_id.is_empty() {
            return Err(GatewayError::Config("gateway_id cannot be empty".into()));
        }

        if self.buffer_capacity == 0 {
            return Err(GatewayError::Config(
                "buffer_capacity must be greater than 0".into(),
            ));
        }

        if self.modbus.is_empty() {
            return Err(GatewayError::Config(
                "At least one modbus device must be configured".into(),
            ));
        }

        for (i, device) in self.modbus.iter().enumerate() {
            if device.device_id.is_empty() {
                return Err(GatewayError::Config(format!(
                    "Modbus device {} has empty device_id",
                    i
                )));
            }
            if device.host.is_empty() {
                return Err(GatewayError::Config(format!(
                    "Modbus device {} has empty host",
                    i
                )));
            }
            if device.registers.is_empty() {
                return Err(GatewayError::Config(format!(
                    "Modbus device {} has no registers configured",
                    i
                )));
            }
        }

        if self.data_pusher.server_url.is_empty() {
            return Err(GatewayError::Config("server_url cannot be empty".into()));
        }

        if self.data_pusher.batch_size == 0 {
            return Err(GatewayError::Config("batch_size must be greater than 0".into()));
        }

        Ok(())
    }
}
