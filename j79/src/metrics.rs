use crate::data_pusher::PushStats;
use crate::modbus_poller::DeviceConnectionState;
use crate::ring_buffer::BufferStats;
use parking_lot::Mutex;
use prometheus_client::encoding::text::encode;
use prometheus_client::metrics::counter::Counter;
use prometheus_client::metrics::gauge::Gauge;
use prometheus_client::registry::Registry;
use std::sync::Arc;

pub struct MetricsCollector {
    pub registry: Arc<Mutex<Registry>>,

    pub buffer_level: Gauge,
    pub buffer_capacity: Gauge,
    pub buffer_overflow_total: Counter,

    pub device_connected: Gauge,
    pub device_consecutive_errors: Gauge,
    pub device_total_reads: Counter,
    pub device_total_errors: Counter,

    pub push_success_total: Counter,
    pub push_failure_total: Counter,
    pub push_attempts_total: Counter,
    pub push_last_success: Gauge,
    pub push_success_rate_percent: Gauge,

    pub bytes_sent_total: Counter,
    pub bytes_uncompressed_total: Counter,

    device_states: Arc<Mutex<Vec<Arc<Mutex<DeviceConnectionState>>>>>,
    push_stats: Mutex<Option<Arc<Mutex<PushStats>>>>,
    buffer_stats_source: Mutex<Option<Arc<crate::ring_buffer::RingBuffer<crate::ring_buffer::DataPoint>>>>,
}

impl MetricsCollector {
    pub fn new() -> Self {
        let mut registry = Registry::default();

        let buffer_level = Gauge::default();
        let buffer_capacity = Gauge::default();
        let buffer_overflow_total = Counter::default();

        let device_connected = Gauge::default();
        let device_consecutive_errors = Gauge::default();
        let device_total_reads = Counter::default();
        let device_total_errors = Counter::default();

        let push_success_total = Counter::default();
        let push_failure_total = Counter::default();
        let push_attempts_total = Counter::default();
        let push_last_success = Gauge::default();
        let push_success_rate_percent = Gauge::default();

        let bytes_sent_total = Counter::default();
        let bytes_uncompressed_total = Counter::default();

        registry.register(
            "gateway_buffer_level",
            "Current number of items in the ring buffer",
            buffer_level.clone(),
        );
        registry.register(
            "gateway_buffer_capacity",
            "Total capacity of the ring buffer",
            buffer_capacity.clone(),
        );
        registry.register(
            "gateway_buffer_overflow_total",
            "Total number of buffer overflow occurrences",
            buffer_overflow_total.clone(),
        );

        registry.register(
            "gateway_device_connected",
            "PLC connection status (1 = connected, 0 = disconnected)",
            device_connected.clone(),
        );
        registry.register(
            "gateway_device_consecutive_errors",
            "Number of consecutive errors for PLC device",
            device_consecutive_errors.clone(),
        );
        registry.register(
            "gateway_device_reads_total",
            "Total number of successful PLC reads",
            device_total_reads.clone(),
        );
        registry.register(
            "gateway_device_errors_total",
            "Total number of PLC read errors",
            device_total_errors.clone(),
        );

        registry.register(
            "gateway_push_success_total",
            "Total number of successfully pushed data points",
            push_success_total.clone(),
        );
        registry.register(
            "gateway_push_failure_total",
            "Total number of failed data points",
            push_failure_total.clone(),
        );
        registry.register(
            "gateway_push_attempts_total",
            "Total number of push attempts",
            push_attempts_total.clone(),
        );
        registry.register(
            "gateway_push_last_success",
            "Timestamp of last successful push",
            push_last_success.clone(),
        );
        registry.register(
            "gateway_push_success_rate_percent",
            "Success rate of pushes (0-100 percent)",
            push_success_rate_percent.clone(),
        );

        registry.register(
            "gateway_bytes_sent_total",
            "Total bytes sent over network",
            bytes_sent_total.clone(),
        );
        registry.register(
            "gateway_bytes_uncompressed_total",
            "Total bytes before compression",
            bytes_uncompressed_total.clone(),
        );

        Self {
            registry: Arc::new(Mutex::new(registry)),
            buffer_level,
            buffer_capacity,
            buffer_overflow_total,
            device_connected,
            device_consecutive_errors,
            device_total_reads,
            device_total_errors,
            push_success_total,
            push_failure_total,
            push_attempts_total,
            push_last_success,
            push_success_rate_percent,
            bytes_sent_total,
            bytes_uncompressed_total,
            device_states: Arc::new(Mutex::new(Vec::new())),
            push_stats: Mutex::new(None),
            buffer_stats_source: Mutex::new(None),
        }
    }

    pub fn register_device(&self, state: Arc<Mutex<DeviceConnectionState>>) {
        let mut devices = self.device_states.lock();
        devices.push(state);
    }

    pub fn set_push_stats(&self, stats: Arc<Mutex<PushStats>>) {
        *self.push_stats.lock() = Some(stats);
    }

    pub fn set_buffer_source(
        &self,
        buffer: Arc<crate::ring_buffer::RingBuffer<crate::ring_buffer::DataPoint>>,
    ) {
        *self.buffer_stats_source.lock() = Some(buffer);
    }

    pub fn update(&self) {
        if let Some(buffer) = &*self.buffer_stats_source.lock() {
            let stats = buffer.stats();
            self.update_buffer_stats(&stats);
        }

        self.update_device_stats();

        if let Some(push_stats) = &*self.push_stats.lock() {
            let stats = push_stats.lock();
            self.update_push_stats(&stats);
        }
    }

    fn update_buffer_stats(&self, stats: &BufferStats) {
        self.buffer_level.set(stats.len as i64);
        self.buffer_capacity.set(stats.capacity as i64);

        let current = self.buffer_overflow_total.get();
        if stats.overflow_count as u64 > current {
            let diff = stats.overflow_count as u64 - current;
            self.buffer_overflow_total.inc_by(diff);
        }
    }

    fn update_device_stats(&self) {
        let devices = self.device_states.lock();

        let mut total_connected = 0;
        let mut total_consecutive_errors = 0;
        let mut total_reads: u64 = 0;
        let mut total_errors: u64 = 0;

        for device in devices.iter() {
            let state = device.lock();
            if state.connected {
                total_connected += 1;
            }
            total_consecutive_errors += state.consecutive_errors;

            let current_reads = self.device_total_reads.get();
            if state.total_reads > current_reads {
                self.device_total_reads
                    .inc_by(state.total_reads - current_reads);
            }
            total_reads = total_reads.max(state.total_reads);

            let current_errors = self.device_total_errors.get();
            if state.total_errors > current_errors {
                self.device_total_errors
                    .inc_by(state.total_errors - current_errors);
            }
            total_errors = total_errors.max(state.total_errors);
        }

        self.device_connected.set(total_connected as i64);
        self.device_consecutive_errors
            .set(total_consecutive_errors as i64);
    }

    fn update_push_stats(&self, stats: &PushStats) {
        let current_success = self.push_success_total.get();
        if stats.total_pushed > current_success {
            self.push_success_total
                .inc_by(stats.total_pushed - current_success);
        }

        let current_failure = self.push_failure_total.get();
        if stats.total_failed > current_failure {
            self.push_failure_total
                .inc_by(stats.total_failed - current_failure);
        }

        let current_attempts = self.push_attempts_total.get();
        if stats.total_attempts > current_attempts {
            self.push_attempts_total
                .inc_by(stats.total_attempts - current_attempts);
        }

        if stats.last_push_success {
            if let Some(time) = stats.last_push_time {
                self.push_last_success
                    .set(time.timestamp_millis() as i64);
            }
        }

        let total = stats.total_pushed + stats.total_failed;
        if total > 0 {
            let rate_percent = (stats.total_pushed * 100 / total) as i64;
            self.push_success_rate_percent.set(rate_percent);
        }

        let current_bytes = self.bytes_sent_total.get();
        if stats.total_bytes_sent > current_bytes {
            self.bytes_sent_total
                .inc_by(stats.total_bytes_sent - current_bytes);
        }

        let current_uncompressed = self.bytes_uncompressed_total.get();
        if stats.total_bytes_uncompressed > current_uncompressed {
            self.bytes_uncompressed_total
                .inc_by(stats.total_bytes_uncompressed - current_uncompressed);
        }
    }

    pub fn gather(&self) -> String {
        self.update();
        let mut buffer = String::new();
        let registry = self.registry.lock();
        encode(&mut buffer, &registry).unwrap();
        buffer
    }
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}
