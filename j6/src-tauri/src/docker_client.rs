use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use bollard::container::{ListContainersOptions, LogsOptions, StatsOptions};
use bollard::models::ContainerSummary;
use bollard::Docker;
use futures_util::StreamExt;

use crate::models::{AppError, Container, ContainerStats, LogMessage};

#[async_trait]
pub trait LogSender: Send + Sync {
    async fn send(&self, msg: LogMessage) -> Result<(), ()>;
}

#[derive(Clone)]
pub struct DockerClient {
    docker: Arc<Docker>,
}

impl DockerClient {
    pub async fn new() -> Result<Self, AppError> {
        let docker = Docker::connect_with_local_defaults()
            .map_err(|e| AppError::DockerError(format!("Failed to connect to Docker: {}", e)))?;

        docker
            .ping()
            .await
            .map_err(|e| AppError::DockerError(format!("Docker ping failed: {}", e)))?;

        Ok(Self {
            docker: Arc::new(docker),
        })
    }

    pub async fn list_containers(&self) -> Result<Vec<Container>, AppError> {
        let mut filters = HashMap::new();
        filters.insert("status", vec!["running", "exited", "paused"]);

        let options = ListContainersOptions {
            all: true,
            filters,
            ..Default::default()
        };

        let containers = self.docker.list_containers(Some(options)).await?;

        Ok(containers
            .into_iter()
            .map(|c| self.summary_to_container(c))
            .collect())
    }

    pub async fn get_container_stats(&self) -> Result<Vec<ContainerStats>, AppError> {
        let containers = self.list_containers().await?;
        let mut stats = Vec::new();

        for container in containers {
            if container.status == "running" {
                match self.get_single_container_stats(&container.id).await {
                    Ok(stat) => stats.push(stat),
                    Err(e) => {
                        eprintln!("Failed to get stats for {}: {}", container.id, e);
                    }
                }
            }
        }

        Ok(stats)
    }

    pub async fn get_single_container_stats(
        &self,
        container_id: &str,
    ) -> Result<ContainerStats, AppError> {
        let options = StatsOptions {
            stream: false,
            one_shot: true,
        };

        let mut stats_stream = self.docker.stats(container_id, Some(options));

        if let Some(stat_result) = stats_stream.next().await {
            let stat = stat_result?;

            let cpu_delta = stat.cpu_stats.cpu_usage.total_usage.unwrap_or(0)
                - stat.precpu_stats.cpu_usage.total_usage.unwrap_or(0);
            let system_delta = stat.cpu_stats.system_cpu_usage.unwrap_or(0)
                - stat.precpu_stats.system_cpu_usage.unwrap_or(0);
            let number_cpus = stat.cpu_stats.online_cpus.unwrap_or(1) as f64;

            let cpu_usage = if system_delta > 0 {
                (cpu_delta as f64 / system_delta as f64) * number_cpus * 100.0
            } else {
                0.0
            };

            let memory_usage = stat.memory_stats.usage.unwrap_or(0);
            let memory_limit = stat.memory_stats.limit.unwrap_or(1);
            let memory_percent = (memory_usage as f64 / memory_limit as f64) * 100.0;

            Ok(ContainerStats {
                id: container_id.to_string(),
                cpu_usage: (cpu_usage * 100.0).round() / 100.0,
                memory_usage: (memory_percent * 100.0).round() / 100.0,
                memory_usage_bytes: memory_usage,
                memory_limit_bytes: memory_limit,
            })
        } else {
            Err(AppError::DockerError(format!(
                "No stats returned for container {}",
                container_id
            )))
        }
    }

    pub async fn stream_logs(
        &self,
        container_id: &str,
        sender: impl LogSender + 'static,
        follow: bool,
    ) -> Result<(), AppError> {
        let options = LogsOptions {
            follow,
            stdout: true,
            stderr: true,
            since: 0,
            timestamps: true,
            ..Default::default()
        };

        let mut log_stream = self.docker.logs(container_id, Some(options));

        while let Some(log_result) = log_stream.next().await {
            let log = log_result?;

            let stream = match log {
                bollard::container::LogOutput::StdOut { message } => {
                    let content = String::from_utf8_lossy(&message).to_string();
                    LogMessage {
                        stream: "stdout".to_string(),
                        content: content.trim_end().to_string(),
                        timestamp: chrono::Utc::now().timestamp_millis(),
                    }
                }
                bollard::container::LogOutput::StdErr { message } => {
                    let content = String::from_utf8_lossy(&message).to_string();
                    LogMessage {
                        stream: "stderr".to_string(),
                        content: content.trim_end().to_string(),
                        timestamp: chrono::Utc::now().timestamp_millis(),
                    }
                }
                _ => continue,
            };

            if sender.send(stream).await.is_err() {
                break;
            }
        }

        Ok(())
    }

    fn summary_to_container(&self, summary: ContainerSummary) -> Container {
        let name = summary
            .names
            .and_then(|names| names.first().cloned())
            .unwrap_or_else(|| "unknown".to_string())
            .trim_start_matches('/')
            .to_string();

        let state = summary.state.clone().unwrap_or_else(|| "unknown".to_string());
        let status = summary.status.clone().unwrap_or_else(|| "unknown".to_string());

        Container {
            id: summary.id.unwrap_or_else(|| "unknown".to_string()),
            name,
            status: state.clone(),
            state,
            image: summary.image.unwrap_or_else(|| "unknown".to_string()),
            created: summary.created.unwrap_or(0),
            cpu_usage: 0.0,
            memory_usage: 0.0,
            memory_usage_bytes: 0,
            memory_limit_bytes: 0,
        }
    }
}
