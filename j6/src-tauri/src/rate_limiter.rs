use std::collections::VecDeque;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::Mutex;

use crate::models::LogMessage;

const DEFAULT_UI_BATCH_INTERVAL_MS: u64 = 150;
const DEFAULT_UI_MAX_BATCH_SIZE: usize = 20;
const DEFAULT_UI_MAX_QUEUE_SIZE: usize = 100;
const DEFAULT_WS_MAX_RATE_PER_SEC: u64 = 500;
const DEFAULT_WS_BATCH_INTERVAL_MS: u64 = 50;
const DEFAULT_WS_MAX_BATCH_SIZE: usize = 50;
const DEFAULT_WS_MAX_QUEUE_SIZE: usize = 2000;

#[derive(Clone)]
pub struct LogRateLimiter {
    inner: Arc<Mutex<RateLimiterInner>>,
}

struct RateLimiterInner {
    ui_queue: VecDeque<LogMessage>,
    ws_queue: VecDeque<LogMessage>,
    last_ui_emit: Instant,
    last_ws_send: Instant,
    ws_tokens: u64,
    ws_last_refill: Instant,
    total_received: u64,
    total_dropped_ui: u64,
    total_dropped_ws: u64,
}

impl LogRateLimiter {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(RateLimiterInner {
                ui_queue: VecDeque::with_capacity(DEFAULT_UI_MAX_QUEUE_SIZE),
                ws_queue: VecDeque::with_capacity(DEFAULT_WS_MAX_QUEUE_SIZE),
                last_ui_emit: Instant::now(),
                last_ws_send: Instant::now(),
                ws_tokens: DEFAULT_WS_MAX_RATE_PER_SEC,
                ws_last_refill: Instant::now(),
                total_received: 0,
                total_dropped_ui: 0,
                total_dropped_ws: 0,
            })),
        }
    }

    pub async fn submit(&self, log: LogMessage) -> (bool, bool) {
        let mut inner = self.inner.lock().await;
        inner.total_received += 1;

        let mut ui_queued = true;
        let mut ws_queued = true;

        if inner.ui_queue.len() >= DEFAULT_UI_MAX_QUEUE_SIZE {
            inner.ui_queue.pop_front();
            inner.total_dropped_ui += 1;
            ui_queued = false;
        }
        inner.ui_queue.push_back(log.clone());

        if inner.ws_queue.len() >= DEFAULT_WS_MAX_QUEUE_SIZE {
            inner.ws_queue.pop_front();
            inner.total_dropped_ws += 1;
            ws_queued = false;
        }
        inner.ws_queue.push_back(log);

        (ui_queued, ws_queued)
    }

    pub async fn drain_ui_batch(&self) -> Vec<LogMessage> {
        let mut inner = self.inner.lock().await;
        let now = Instant::now();
        let elapsed = now.duration_since(inner.last_ui_emit);

        if elapsed < Duration::from_millis(DEFAULT_UI_BATCH_INTERVAL_MS)
            && inner.ui_queue.len() < DEFAULT_UI_MAX_BATCH_SIZE
        {
            return Vec::new();
        }

        let batch_size = std::cmp::min(inner.ui_queue.len(), DEFAULT_UI_MAX_BATCH_SIZE);
        let batch: Vec<LogMessage> = inner.ui_queue.drain(..batch_size).collect();
        inner.last_ui_emit = now;
        batch
    }

    pub async fn drain_ws_batch(&self) -> Vec<LogMessage> {
        let mut inner = self.inner.lock().await;
        let now = Instant::now();

        let elapsed = now.duration_since(inner.ws_last_refill);
        if elapsed >= Duration::from_secs(1) {
            inner.ws_tokens = DEFAULT_WS_MAX_RATE_PER_SEC;
            inner.ws_last_refill = now;
        }

        let elapsed_send = now.duration_since(inner.last_ws_send);
        if elapsed_send < Duration::from_millis(DEFAULT_WS_BATCH_INTERVAL_MS) {
            return Vec::new();
        }

        if inner.ws_tokens == 0 {
            return Vec::new();
        }

        let max_send = std::cmp::min(
            std::cmp::min(inner.ws_queue.len(), DEFAULT_WS_MAX_BATCH_SIZE),
            inner.ws_tokens as usize,
        );

        if max_send == 0 {
            return Vec::new();
        }

        let batch: Vec<LogMessage> = inner.ws_queue.drain(..max_send).collect();
        inner.ws_tokens = inner.ws_tokens.saturating_sub(batch.len() as u64);
        inner.last_ws_send = now;
        batch
    }

    pub async fn get_stats(&self) -> RateLimiterStats {
        let inner = self.inner.lock().await;
        RateLimiterStats {
            total_received: inner.total_received,
            total_dropped_ui: inner.total_dropped_ui,
            total_dropped_ws: inner.total_dropped_ws,
            ui_queue_size: inner.ui_queue.len(),
            ws_queue_size: inner.ws_queue.len(),
            ws_tokens_remaining: inner.ws_tokens,
        }
    }

    pub async fn reset(&self) {
        let mut inner = self.inner.lock().await;
        inner.ui_queue.clear();
        inner.ws_queue.clear();
        inner.total_received = 0;
        inner.total_dropped_ui = 0;
        inner.total_dropped_ws = 0;
        inner.ws_tokens = DEFAULT_WS_MAX_RATE_PER_SEC;
        inner.last_ui_emit = Instant::now();
        inner.last_ws_send = Instant::now();
        inner.ws_last_refill = Instant::now();
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RateLimiterStats {
    pub total_received: u64,
    pub total_dropped_ui: u64,
    pub total_dropped_ws: u64,
    pub ui_queue_size: usize,
    pub ws_queue_size: usize,
    pub ws_tokens_remaining: u64,
}

impl Default for LogRateLimiter {
    fn default() -> Self {
        Self::new()
    }
}
