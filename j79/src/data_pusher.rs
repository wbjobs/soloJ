use crate::crypto::{CryptoConfig, CryptoHandler};
use crate::error::{GatewayError, Result};
use crate::ring_buffer::{BufferStats, DataPoint, RingBuffer};
use reqwest::Client;
use serde::Serialize;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DataPusherConfig {
    pub server_url: String,
    pub api_key: String,
    pub batch_size: usize,
    pub push_interval_ms: u64,
    pub max_retries: u32,
    pub retry_delay_ms: u64,
    pub timeout_ms: u64,
}

#[derive(Debug, Serialize)]
struct DataBatch<'a> {
    gateway_id: &'a str,
    timestamp: chrono::DateTime<chrono::Utc>,
    count: usize,
    data: &'a [DataPoint],
}

#[derive(Debug, Clone)]
pub struct PushStats {
    pub total_pushed: u64,
    pub total_failed: u64,
    pub total_attempts: u64,
    pub total_bytes_sent: u64,
    pub total_bytes_uncompressed: u64,
    pub last_push_time: Option<chrono::DateTime<chrono::Utc>>,
    pub last_push_success: bool,
}

impl Default for PushStats {
    fn default() -> Self {
        Self {
            total_pushed: 0,
            total_failed: 0,
            total_attempts: 0,
            total_bytes_sent: 0,
            total_bytes_uncompressed: 0,
            last_push_time: None,
            last_push_success: false,
        }
    }
}

pub struct DataPusher {
    config: DataPusherConfig,
    buffer: Arc<RingBuffer<DataPoint>>,
    client: Client,
    gateway_id: String,
    shutdown: watch::Receiver<bool>,
    stats: Arc<parking_lot::Mutex<PushStats>>,
    crypto: Option<CryptoHandler>,
}

impl DataPusher {
    pub fn new(
        config: DataPusherConfig,
        buffer: Arc<RingBuffer<DataPoint>>,
        gateway_id: String,
        shutdown: watch::Receiver<bool>,
        crypto_config: Option<CryptoConfig>,
    ) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_millis(config.timeout_ms))
            .build()
            .map_err(|e| GatewayError::HttpRequest(e))?;

        let crypto = match crypto_config {
            Some(cfg) if cfg.enable_compression || cfg.enable_encryption => {
                Some(CryptoHandler::new(cfg)?)
            }
            _ => None,
        };

        Ok(Self {
            config,
            buffer,
            client,
            gateway_id,
            shutdown,
            stats: Arc::new(parking_lot::Mutex::new(PushStats::default())),
            crypto,
        })
    }

    pub async fn run(&mut self) -> Result<()> {
        let push_interval = Duration::from_millis(self.config.push_interval_ms);
        let pop_timeout = Duration::from_millis(500);

        log::info!(
            "Starting DataPusher for server {}",
            self.config.server_url
        );
        log::info!(
            "Compression: {}, Encryption: {}",
            self.crypto
                .as_ref()
                .map(|c| c.config().enable_compression)
                .unwrap_or(false),
            self.crypto
                .as_ref()
                .map(|c| c.config().enable_encryption)
                .unwrap_or(false)
        );

        while !*self.shutdown.borrow() {
            let batch_result = self
                .buffer
                .pop_batch(self.config.batch_size, pop_timeout);

            match batch_result {
                Ok(batch) if !batch.is_empty() => {
                    let batch_size = batch.len();
                    log::debug!("Pushing batch of {} data points", batch_size);

                    {
                        let mut stats = self.stats.lock();
                        stats.total_attempts += 1;
                    }

                    match self.push_with_retry(&batch).await {
                        Ok(bytes_info) => {
                            let mut stats = self.stats.lock();
                            stats.total_pushed += batch_size as u64;
                            stats.total_bytes_sent += bytes_info.0 as u64;
                            stats.total_bytes_uncompressed += bytes_info.1 as u64;
                            stats.last_push_time = Some(chrono::Utc::now());
                            stats.last_push_success = true;
                            log::info!(
                                "Successfully pushed {} data points ({} -> {} bytes)",
                                batch_size,
                                bytes_info.1,
                                bytes_info.0
                            );
                        }
                        Err(e) => {
                            let mut stats = self.stats.lock();
                            stats.total_failed += batch_size as u64;
                            stats.last_push_time = Some(chrono::Utc::now());
                            stats.last_push_success = false;
                            log::error!("Failed to push data after retries: {}", e);
                            self.requeue_batch(&batch);
                        }
                    }
                }
                Ok(_) => {}
                Err(GatewayError::BufferEmpty) => {
                    tokio::select! {
                        _ = tokio::time::sleep(push_interval) => {}
                        _ = self.shutdown.changed() => {
                            break;
                        }
                    }
                }
                Err(e) => {
                    log::error!("Error popping from buffer: {}", e);
                    tokio::time::sleep(Duration::from_secs(1)).await;
                }
            }
        }

        self.flush_remaining().await?;

        log::info!("DataPusher stopped");
        Ok(())
    }

    async fn push_with_retry(&self, batch: &[DataPoint]) -> Result<(usize, usize)> {
        let mut last_error = None;
        let retry_delay = Duration::from_millis(self.config.retry_delay_ms);
        let mut bytes_result = None;

        for attempt in 0..=self.config.max_retries {
            match self.push_batch(batch).await {
                Ok(bytes) => {
                    bytes_result = Some(bytes);
                    break;
                }
                Err(e) => {
                    log::warn!(
                        "Push attempt {}/{} failed: {}",
                        attempt + 1,
                        self.config.max_retries + 1,
                        e
                    );
                    last_error = Some(e);
                    if attempt < self.config.max_retries {
                        tokio::time::sleep(retry_delay).await;
                    }
                }
            }
        }

        match bytes_result {
            Some(bytes) => Ok(bytes),
            None => Err(last_error.unwrap_or_else(|| {
                GatewayError::Other("Unknown push error".into())
            })),
        }
    }

    async fn push_batch(&self, batch: &[DataPoint]) -> Result<(usize, usize)> {
        let payload = DataBatch {
            gateway_id: &self.gateway_id,
            timestamp: chrono::Utc::now(),
            count: batch.len(),
            data: batch,
        };

        let json_payload = serde_json::to_vec(&payload)?;
        let original_size = json_payload.len();

        let body = if let Some(crypto) = &self.crypto {
            crypto.process(&json_payload)?
        } else {
            json_payload
        };

        let compressed_size = body.len();

        let mut request = self
            .client
            .post(&self.config.server_url)
            .header("X-API-Key", &self.config.api_key);

        if self.crypto.is_some() {
            request = request
                .header("X-Content-Encoding", "aes256gcm-gzip")
                .header("Content-Type", "application/octet-stream");
        } else {
            request = request.header("Content-Type", "application/json");
        }

        let response = request.body(body).send().await?;

        let status = response.status();
        if !status.is_success() {
            let error_body = response.text().await.unwrap_or_default();
            return Err(GatewayError::Other(format!(
                "Server returned {}: {}",
                status, error_body
            )));
        }

        Ok((compressed_size, original_size))
    }

    fn requeue_batch(&self, batch: &[DataPoint]) {
        log::warn!("Requeuing {} data points", batch.len());
        for point in batch {
            if let Err(e) = self.buffer.try_push(point.clone()) {
                log::error!("Failed to requeue data point: {}", e);
            }
        }
    }

    async fn flush_remaining(&self) -> Result<()> {
        log::info!("Flushing remaining data from buffer");

        loop {
            match self.buffer.try_pop() {
                Ok(point) => {
                    if let Err(e) = self.push_batch(&[point]).await {
                        log::error!("Failed to flush data point: {}", e);
                    }
                }
                Err(GatewayError::BufferEmpty) => break,
                Err(e) => {
                    log::error!("Error flushing buffer: {}", e);
                    break;
                }
            }
        }

        Ok(())
    }

    pub fn get_stats(&self) -> PushStats {
        let stats = self.stats.lock();
        stats.clone()
    }

    pub fn get_buffer_stats(&self) -> BufferStats {
        self.buffer.stats()
    }

    pub fn stats_arc(&self) -> Arc<parking_lot::Mutex<PushStats>> {
        self.stats.clone()
    }
}
