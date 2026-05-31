use prometheus::{
    Histogram, HistogramOpts, IntCounter, IntCounterVec, Opts, Registry,
};
use std::sync::OnceLock;

pub static REGISTRY: OnceLock<Registry> = OnceLock::new();
pub static TAMPER_COUNTER: OnceLock<IntCounterVec> = OnceLock::new();
pub static VERIFY_DURATION: OnceLock<Histogram> = OnceLock::new();
pub static RECOVERY_COUNTER: OnceLock<IntCounter> = OnceLock::new();
pub static WEBHOOK_COUNTER: OnceLock<IntCounterVec> = OnceLock::new();

pub fn init_metrics() {
    let registry = Registry::new();

    let tamper_counter = IntCounterVec::new(
        Opts::new(
            "file_monitor_tamper_total",
            "Total number of file tampering incidents detected",
        ),
        &["type"],
    )
    .unwrap();
    registry.register(Box::new(tamper_counter.clone())).unwrap();
    TAMPER_COUNTER.set(tamper_counter).unwrap();

    let verify_duration = Histogram::with_opts(HistogramOpts::new(
        "file_monitor_verify_duration_seconds",
        "Time spent verifying file integrity",
    ))
    .unwrap();
    registry.register(Box::new(verify_duration.clone())).unwrap();
    VERIFY_DURATION.set(verify_duration).unwrap();

    let recovery_counter = IntCounter::new(
        "file_monitor_recovery_total",
        "Total number of file recovery operations performed",
    )
    .unwrap();
    registry.register(Box::new(recovery_counter.clone())).unwrap();
    RECOVERY_COUNTER.set(recovery_counter).unwrap();

    let webhook_counter = IntCounterVec::new(
        Opts::new(
            "file_monitor_webhook_total",
            "Total number of webhook notifications sent",
        ),
        &["status"],
    )
    .unwrap();
    registry.register(Box::new(webhook_counter.clone())).unwrap();
    WEBHOOK_COUNTER.set(webhook_counter).unwrap();

    REGISTRY.set(registry).unwrap();
}

pub fn record_tamper(change_type: &str) {
    if let Some(counter) = TAMPER_COUNTER.get() {
        counter.with_label_values(&[change_type]).inc();
    }
}

pub fn record_verify_duration(seconds: f64) {
    if let Some(histogram) = VERIFY_DURATION.get() {
        histogram.observe(seconds);
    }
}

pub fn record_recovery() {
    if let Some(counter) = RECOVERY_COUNTER.get() {
        counter.inc();
    }
}

pub fn record_webhook(success: bool) {
    if let Some(counter) = WEBHOOK_COUNTER.get() {
        let status = if success { "success" } else { "failure" };
        counter.with_label_values(&[status]).inc();
    }
}

pub fn gather_metrics() -> String {
    use prometheus::Encoder;
    let encoder = prometheus::TextEncoder::new();
    let mut buffer = Vec::new();
    if let Some(registry) = REGISTRY.get() {
        encoder.encode(&registry.gather(), &mut buffer).unwrap();
    }
    String::from_utf8(buffer).unwrap_or_default()
}
