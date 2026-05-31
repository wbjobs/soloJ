mod config;
mod crypto;
mod data_pusher;
mod error;
mod metrics;
mod metrics_server;
mod modbus_poller;
mod ring_buffer;

use clap::Parser;
use config::GatewayConfig;
use crypto::generate_encryption_key;
use data_pusher::DataPusher;
use error::Result;
use metrics::MetricsCollector;
use modbus_poller::ModbusPoller;
use ring_buffer::{DataPoint, RingBuffer};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long, default_value = "config.toml")]
    config: String,

    #[arg(long)]
    generate_key: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    if args.generate_key {
        let key = generate_encryption_key();
        println!("Generated AES-256 encryption key:");
        println!("{}", key);
        println!();
        println!("Add this to your config.toml under [crypto] section:");
        println!("encryption_key = \"{}\"", key);
        return Ok(());
    }

    let config = GatewayConfig::load(&args.config)?;

    init_logger(&config);

    log::info!("Starting Data Sync Gateway: {}", config.gateway_id);
    log::info!("Buffer capacity: {}", config.buffer_capacity);
    log::info!(
        "Buffer overflow strategy: {:?}",
        config.buffer_overflow_strategy
    );
    log::info!("Modbus devices: {}", config.modbus.len());
    log::info!(
        "Crypto: compression={}, encryption={}",
        config.crypto.enable_compression,
        config.crypto.enable_encryption
    );
    log::info!(
        "Metrics: enabled={}, bind={}:{}",
        config.metrics.enabled,
        config.metrics.host,
        config.metrics.port
    );

    let buffer = RingBuffer::<DataPoint>::with_strategy(
        config.buffer_capacity,
        config.buffer_overflow_strategy,
    );

    let metrics = MetricsCollector::new();
    metrics.set_buffer_source(buffer.clone());
    let metrics = Arc::new(metrics);

    let (shutdown_tx, shutdown_rx) = watch::channel(false);

    let mut poller_handles = Vec::new();
    for device_config in &config.modbus {
        let poller = ModbusPoller::new(
            device_config.clone(),
            buffer.clone(),
            shutdown_rx.clone(),
        );

        metrics.register_device(poller.connection_state());

        let mut poller = poller;
        let handle = tokio::spawn(async move {
            if let Err(e) = poller.run().await {
                log::error!("ModbusPoller error: {}", e);
            }
        });
        poller_handles.push(handle);
    }

    let mut pusher = DataPusher::new(
        config.data_pusher.clone(),
        buffer.clone(),
        config.gateway_id.clone(),
        shutdown_rx.clone(),
        Some(config.crypto.clone()),
    )?;

    metrics.set_push_stats(pusher.stats_arc());

    let pusher_handle = tokio::spawn(async move {
        if let Err(e) = pusher.run().await {
            log::error!("DataPusher error: {}", e);
        }
    });

    let metrics_config = config.metrics.clone();
    let metrics_clone = metrics.clone();
    let metrics_shutdown = shutdown_rx.clone();
    let metrics_server_handle = tokio::spawn(async move {
        if let Err(e) =
            metrics_server::start_metrics_server(metrics_config, metrics_clone, metrics_shutdown)
                .await
        {
            log::error!("Metrics server error: {}", e);
        }
    });

    let buffer_clone = buffer.clone();
    let stats_interval = Duration::from_secs(config.stats_interval_secs);
    let gateway_id = config.gateway_id.clone();
    let stats_handle = tokio::spawn(async move {
        loop {
            tokio::time::sleep(stats_interval).await;
            let stats = buffer_clone.stats();
            log::info!(
                "[{}] Buffer stats: {}/{} (used/capacity), tx: {}, rx: {}, overflow: {}",
                gateway_id,
                stats.len,
                stats.capacity,
                stats.tx_count,
                stats.rx_count,
                stats.overflow_count
            );
        }
    });

    tokio::spawn(async move {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to listen for ctrl_c");
        log::info!("Received shutdown signal");
        let _ = shutdown_tx.send(true);
    });

    for handle in poller_handles {
        let _ = handle.await;
    }
    let _ = pusher_handle.await;
    let _ = metrics_server_handle.await;
    stats_handle.abort();

    log::info!("Data Sync Gateway stopped");
    Ok(())
}

fn init_logger(config: &GatewayConfig) {
    let log_level = config
        .log_level
        .as_deref()
        .unwrap_or("info")
        .to_lowercase();

    let filter = match log_level.as_str() {
        "trace" => "trace",
        "debug" => "debug",
        "info" => "info",
        "warn" => "warn",
        "error" => "error",
        _ => "info",
    };

    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or(filter))
        .format_timestamp_millis()
        .format_module_path(false)
        .init();
}
