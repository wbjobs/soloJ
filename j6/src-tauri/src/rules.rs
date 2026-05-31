use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use crate::models::LogMessage;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleConfig {
    pub rules: Vec<Rule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub name: String,
    pub keywords: Vec<String>,
    pub level: String,
    pub notification: bool,
    #[serde(default)]
    pub case_sensitive: bool,
    #[serde(default)]
    pub streams: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleMatch {
    pub rule_name: String,
    pub level: String,
    pub keyword: String,
    pub content: String,
    pub stream: String,
    pub timestamp: i64,
}

unsafe impl Send for RuleMatch {}
unsafe impl Sync for RuleMatch {}

pub struct RuleEngine {
    config: Arc<Mutex<RuleConfig>>,
    config_path: PathBuf,
}

impl RuleEngine {
    pub async fn new(config_path: PathBuf) -> Result<Self, crate::models::AppError> {
        let config = if config_path.exists() {
            Self::load_config(&config_path)?
        } else {
            let default_config = Self::default_config();
            Self::save_config(&config_path, &default_config)?;
            default_config
        };

        Ok(Self {
            config: Arc::new(Mutex::new(config)),
            config_path,
        })
    }

    fn default_config() -> RuleConfig {
        RuleConfig {
            rules: vec![
                Rule {
                    name: "Error Detection".to_string(),
                    keywords: vec!["ERROR".to_string(), "Error".to_string(), "error".to_string()],
                    level: "error".to_string(),
                    notification: true,
                    case_sensitive: false,
                    streams: vec!["stderr".to_string(), "stdout".to_string()],
                },
                Rule {
                    name: "Timeout Detection".to_string(),
                    keywords: vec!["timeout".to_string(), "Timeout".to_string(), "TIMEOUT".to_string()],
                    level: "warning".to_string(),
                    notification: true,
                    case_sensitive: false,
                    streams: vec!["stderr".to_string(), "stdout".to_string()],
                },
                Rule {
                    name: "Warning Detection".to_string(),
                    keywords: vec!["WARN".to_string(), "Warning".to_string(), "warning".to_string()],
                    level: "warning".to_string(),
                    notification: false,
                    case_sensitive: false,
                    streams: vec!["stderr".to_string(), "stdout".to_string()],
                },
                Rule {
                    name: "Panic Detection".to_string(),
                    keywords: vec!["panic".to_string(), "PANIC".to_string()],
                    level: "error".to_string(),
                    notification: true,
                    case_sensitive: false,
                    streams: vec!["stderr".to_string()],
                },
                Rule {
                    name: "Fatal Error".to_string(),
                    keywords: vec!["FATAL".to_string(), "fatal".to_string()],
                    level: "error".to_string(),
                    notification: true,
                    case_sensitive: false,
                    streams: vec!["stderr".to_string(), "stdout".to_string()],
                },
                Rule {
                    name: "404 Errors".to_string(),
                    keywords: vec!["404".to_string()],
                    level: "warning".to_string(),
                    notification: false,
                    case_sensitive: false,
                    streams: vec!["stdout".to_string(), "stderr".to_string()],
                },
                Rule {
                    name: "500 Errors".to_string(),
                    keywords: vec!["500".to_string()],
                    level: "error".to_string(),
                    notification: true,
                    case_sensitive: false,
                    streams: vec!["stdout".to_string(), "stderr".to_string()],
                },
                Rule {
                    name: "OOM Detection".to_string(),
                    keywords: vec!["OOM".to_string(), "out of memory".to_string(), "Out of memory".to_string()],
                    level: "error".to_string(),
                    notification: true,
                    case_sensitive: false,
                    streams: vec!["stderr".to_string()],
                },
            ],
        }
    }

    pub fn load_config(path: &PathBuf) -> Result<RuleConfig, crate::models::AppError> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| crate::models::AppError::IoError(e))?;
        let config: RuleConfig = serde_yaml::from_str(&content)
            .map_err(|e| crate::models::AppError::Other(format!("YAML parse error: {}", e)))?;
        Ok(config)
    }

    pub fn save_config(path: &PathBuf, config: &RuleConfig) -> Result<(), crate::models::AppError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| crate::models::AppError::IoError(e))?;
        }
        let yaml = serde_yaml::to_string(config)
            .map_err(|e| crate::models::AppError::Other(format!("YAML serialize error: {}", e)))?;
        std::fs::write(path, yaml)
            .map_err(|e| crate::models::AppError::IoError(e))?;
        Ok(())
    }

    pub async fn get_rules(&self) -> RuleConfig {
        self.config.lock().await.clone()
    }

    pub async fn update_rules(&self, rules: RuleConfig) -> Result<(), crate::models::AppError> {
        Self::save_config(&self.config_path, &rules)?;
        *self.config.lock().await = rules;
        Ok(())
    }

    pub async fn check_log(&self, log: &LogMessage) -> Vec<RuleMatch> {
        let config = self.config.lock().await;
        let mut matches = Vec::new();

        for rule in &config.rules {
            if !rule.streams.is_empty() && !rule.streams.contains(&log.stream) {
                continue;
            }

            let content_lower = if rule.case_sensitive {
                log.content.clone()
            } else {
                log.content.to_lowercase()
            };

            for keyword in &rule.keywords {
                let keyword_check = if rule.case_sensitive {
                    keyword.clone()
                } else {
                    keyword.to_lowercase()
                };

                if content_lower.contains(&keyword_check) {
                    matches.push(RuleMatch {
                        rule_name: rule.name.clone(),
                        level: rule.level.clone(),
                        keyword: keyword.clone(),
                        content: log.content.clone(),
                        stream: log.stream.clone(),
                        timestamp: log.timestamp,
                    });
                    break;
                }
            }
        }

        matches
    }

    pub async fn should_notify(&self, level: &str) -> bool {
        let config = self.config.lock().await;
        config.rules.iter().any(|r| r.level == level && r.notification)
    }

    pub fn send_system_notification(title: &str, message: &str) {
        let notification = notify_rust::Notification::new()
            .summary(title)
            .body(message)
            .timeout(notify_rust::Timeout::Milliseconds(5000));

        if let Err(e) = notification.show() {
            eprintln!("Failed to send notification: {}", e);
        }
    }
}
