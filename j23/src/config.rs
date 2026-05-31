use serde::Deserialize;
use std::path::Path;
use std::fs;

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub network: NetworkConfig,
    pub protocol: ProtocolConfig,
    #[serde(default)]
    pub multipath: MultiPathConfig,
}

#[derive(Debug, Deserialize, Clone)]
pub struct NetworkConfig {
    pub loss_rate: f64,
    pub base_delay_ms: u64,
    pub jitter_ms: u64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ProtocolConfig {
    pub mss: usize,
    pub initial_window: u32,
    pub max_window: u32,
    pub initial_rto_ms: u64,
    pub min_rto_ms: u64,
    pub max_rto_ms: u64,
    pub handshake_timeout_ms: u64,
    pub max_retries: u32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MultiPathConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_paths")]
    pub paths: Vec<PathConfig>,
    #[serde(default = "default_scheduler")]
    pub scheduler: String,
}

fn default_paths() -> Vec<PathConfig> {
    vec![PathConfig::default()]
}

fn default_scheduler() -> String {
    "rtt_weighted".to_string()
}

impl Default for MultiPathConfig {
    fn default() -> Self {
        MultiPathConfig {
            enabled: false,
            paths: vec![PathConfig::default()],
            scheduler: "rtt_weighted".to_string(),
        }
    }
}

#[derive(Debug, Deserialize, Clone)]
pub struct PathConfig {
    pub name: String,
    pub bind_addr: String,
    pub remote_addr: String,
    #[serde(default)]
    pub loss_rate: Option<f64>,
    #[serde(default)]
    pub base_delay_ms: Option<u64>,
    #[serde(default)]
    pub jitter_ms: Option<u64>,
}

impl Default for PathConfig {
    fn default() -> Self {
        PathConfig {
            name: "default".to_string(),
            bind_addr: "0.0.0.0:0".to_string(),
            remote_addr: "127.0.0.1:8080".to_string(),
            loss_rate: None,
            base_delay_ms: None,
            jitter_ms: None,
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Config {
            network: NetworkConfig {
                loss_rate: 0.0,
                base_delay_ms: 0,
                jitter_ms: 0,
            },
            protocol: ProtocolConfig {
                mss: 1400,
            initial_window: 10,
            max_window: 1000,
            initial_rto_ms: 1000,
            min_rto_ms: 500,
            max_rto_ms: 60000,
            handshake_timeout_ms: 3000,
            max_retries: 15,
            },
        }
    }
}

impl Config {
    pub fn load(path: &Path) -> anyhow::Result<Self> {
        let content = fs::read_to_string(path)?;
        let config: Config = toml::from_str(&content)?;
        config.validate()?;
        Ok(config)
    }

    fn validate(&self) -> anyhow::Result<()> {
        if self.network.loss_rate < 0.0 || self.network.loss_rate > 1.0 {
            anyhow::bail!("Loss rate must be between 0 and 1");
        }
        if self.protocol.mss == 0 {
            anyhow::bail!("MSS must be greater than 0");
        }
        if self.protocol.initial_window == 0 {
            anyhow::bail!("Initial window must be greater than 0");
        }
        Ok(())
    }
}
