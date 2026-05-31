use crate::error::{GatewayError, Result};
use crate::ring_buffer::{DataPoint, RingBuffer};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;
use tokio_modbus::client::Context;
use tokio_modbus::client::tcp;
use tokio_modbus::prelude::{Reader, Slave, SlaveContext};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ModbusConfig {
    pub device_id: String,
    pub host: String,
    pub port: u16,
    pub slave_id: u8,
    pub poll_interval_ms: u64,
    pub registers: Vec<RegisterConfig>,
    pub reconnect_delay_ms: u64,
    pub max_reconnect_attempts: Option<u32>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RegisterConfig {
    pub address: u16,
    pub count: u16,
    pub data_type: DataType,
}

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub enum DataType {
    Int16,
    UInt16,
    Int32,
    UInt32,
    Float32,
}

#[derive(Debug, Clone)]
pub struct DeviceConnectionState {
    pub device_id: String,
    pub host: String,
    pub port: u16,
    pub connected: bool,
    pub consecutive_errors: u32,
    pub last_connection_time: Option<chrono::DateTime<chrono::Utc>>,
    pub last_disconnection_time: Option<chrono::DateTime<chrono::Utc>>,
    pub total_reads: u64,
    pub total_errors: u64,
}

pub struct ModbusPoller {
    config: ModbusConfig,
    buffer: Arc<RingBuffer<DataPoint>>,
    shutdown: watch::Receiver<bool>,
    consecutive_errors: u32,
    state: Arc<parking_lot::Mutex<DeviceConnectionState>>,
}

impl ModbusPoller {
    pub fn new(
        config: ModbusConfig,
        buffer: Arc<RingBuffer<DataPoint>>,
        shutdown: watch::Receiver<bool>,
    ) -> Self {
        let state = Arc::new(parking_lot::Mutex::new(DeviceConnectionState {
            device_id: config.device_id.clone(),
            host: config.host.clone(),
            port: config.port,
            connected: false,
            consecutive_errors: 0,
            last_connection_time: None,
            last_disconnection_time: None,
            total_reads: 0,
            total_errors: 0,
        }));

        Self {
            config,
            buffer,
            shutdown,
            consecutive_errors: 0,
            state,
        }
    }

    pub fn connection_state(&self) -> Arc<parking_lot::Mutex<DeviceConnectionState>> {
        self.state.clone()
    }

    pub async fn run(&mut self) -> Result<()> {
        let interval = Duration::from_millis(self.config.poll_interval_ms);
        let reconnect_delay = Duration::from_millis(self.config.reconnect_delay_ms);
        let max_attempts = self.config.max_reconnect_attempts.unwrap_or(u32::MAX);

        log::info!(
            "Starting ModbusPoller for device {} at {}:{}",
            self.config.device_id,
            self.config.host,
            self.config.port
        );

        loop {
            if *self.shutdown.borrow() {
                log::info!("ModbusPoller received shutdown signal");
                break;
            }

            if self.consecutive_errors >= max_attempts {
                log::error!(
                    "Max reconnect attempts ({}) reached for device {}, waiting longer...",
                    max_attempts,
                    self.config.device_id
                );
                tokio::time::sleep(reconnect_delay * 10).await;
                self.consecutive_errors = 0;
                continue;
            }

            match self.connect().await {
                Ok(mut ctx) => {
                    log::info!(
                        "Connected to Modbus device {}:{} (slave {})",
                        self.config.host,
                        self.config.port,
                        self.config.slave_id
                    );
                    self.consecutive_errors = 0;
                    {
                        let mut state = self.state.lock();
                        state.connected = true;
                        state.consecutive_errors = 0;
                        state.last_connection_time = Some(chrono::Utc::now());
                    }

                    let mut connection_healthy = true;
                    while connection_healthy && !*self.shutdown.borrow() {
                        match self.poll_cycle(&mut ctx).await {
                            Ok(_) => {
                                self.consecutive_errors = 0;
                                {
                                    let mut state = self.state.lock();
                                    state.consecutive_errors = 0;
                                    state.total_reads += 1;
                                }
                            }
                            Err(PollError::Disconnected) => {
                                log::warn!(
                                    "Modbus device {} disconnected, will reconnect",
                                    self.config.device_id
                                );
                                connection_healthy = false;
                                self.consecutive_errors += 1;
                                {
                                    let mut state = self.state.lock();
                                    state.connected = false;
                                    state.consecutive_errors = self.consecutive_errors;
                                    state.last_disconnection_time = Some(chrono::Utc::now());
                                    state.total_errors += 1;
                                }
                            }
                            Err(PollError::Other(e)) => {
                                log::error!(
                                    "Poll error on device {}: {}",
                                    self.config.device_id,
                                    e
                                );
                                self.consecutive_errors += 1;
                                {
                                    let mut state = self.state.lock();
                                    state.consecutive_errors = self.consecutive_errors;
                                    state.total_errors += 1;
                                }
                                if self.consecutive_errors > 3 {
                                    log::warn!(
                                        "Too many consecutive errors, reconnecting device {}",
                                        self.config.device_id
                                    );
                                    connection_healthy = false;
                                    {
                                        let mut state = self.state.lock();
                                        state.connected = false;
                                        state.last_disconnection_time = Some(chrono::Utc::now());
                                    }
                                }
                            }
                        }

                        tokio::select! {
                            _ = tokio::time::sleep(interval) => {}
                            _ = self.shutdown.changed() => {
                                connection_healthy = false;
                            }
                        }
                    }

                    log::info!("Closing connection to device {}", self.config.device_id);
                    self.safe_disconnect(ctx).await;
                }
                Err(e) => {
                    self.consecutive_errors += 1;
                    log::error!(
                        "Failed to connect to Modbus device {} (attempt {}): {}. Retrying in {:?}",
                        self.config.device_id,
                        self.consecutive_errors,
                        e,
                        reconnect_delay
                    );
                    tokio::time::sleep(reconnect_delay).await;
                }
            }
        }

        log::info!("ModbusPoller stopped for device {}", self.config.device_id);
        Ok(())
    }

    async fn safe_disconnect(&self, mut ctx: Context) {
        if let Err(e) = ctx.disconnect().await {
            log::debug!("Error during disconnect (can be ignored): {}", e);
        }
    }

    async fn connect(&self) -> Result<Context> {
        let socket_addr = format!("{}:{}", self.config.host, self.config.port);

        let addr = socket_addr.parse().map_err(|e| {
            GatewayError::Config(format!("Invalid address {}: {}", socket_addr, e))
        })?;

        let ctx = tcp::connect(addr)
            .await
            .map_err(|e| GatewayError::ModbusClient(format!("Connect error: {}", e)))?;

        let mut ctx = ctx;
        ctx.set_slave(Slave(self.config.slave_id));

        Ok(ctx)
    }

    async fn poll_cycle(&mut self, ctx: &mut Context) -> std::result::Result<(), PollError> {
        for reg_config in &self.config.registers {
            if *self.shutdown.borrow() {
                return Ok(());
            }

            let result = ctx
                .read_holding_registers(reg_config.address, reg_config.count)
                .await;

            match result {
                Ok(data) => {
                    self.process_register_data(reg_config, &data);
                }
                Err(e) => {
                    let err_str = e.to_string();
                    if err_str.contains("Broken pipe")
                        || err_str.contains("Connection reset")
                        || err_str.contains("Not connected")
                        || err_str.contains("Transport endpoint is not connected")
                        || err_str.contains("os error")
                    {
                        return Err(PollError::Disconnected);
                    } else {
                        return Err(PollError::Other(err_str));
                    }
                }
            }
        }
        Ok(())
    }

    fn process_register_data(&self, reg_config: &RegisterConfig, data: &[u16]) {
        let timestamp = chrono::Utc::now();

        match reg_config.data_type {
            DataType::Int16 | DataType::UInt16 => {
                for (i, &value) in data.iter().enumerate() {
                    let value = match reg_config.data_type {
                        DataType::Int16 => value as i16 as i32,
                        DataType::UInt16 => value as i32,
                        _ => unreachable!(),
                    };

                    let data_point = DataPoint {
                        timestamp,
                        device_id: self.config.device_id.clone(),
                        register: reg_config.address + i as u16,
                        value,
                    };

                    if let Err(e) = self.buffer.push(data_point) {
                        log::warn!(
                            "Buffer push error for device {}: {}",
                            self.config.device_id,
                            e
                        );
                    }
                }
            }
            DataType::Int32 | DataType::UInt32 => {
                for chunk in data.chunks(2) {
                    if chunk.len() >= 2 {
                        let high = chunk[0] as u32;
                        let low = chunk[1] as u32;
                        let combined = (high << 16) | low;

                        let value = match reg_config.data_type {
                            DataType::Int32 => combined as i32,
                            DataType::UInt32 => {
                                if combined <= i32::MAX as u32 {
                                    combined as i32
                                } else {
                                    log::warn!(
                                        "UInt32 value {} exceeds i32 range, clamping",
                                        combined
                                    );
                                    i32::MAX
                                }
                            }
                            _ => unreachable!(),
                        };

                        let data_point = DataPoint {
                            timestamp,
                            device_id: self.config.device_id.clone(),
                            register: reg_config.address,
                            value,
                        };

                        if let Err(e) = self.buffer.push(data_point) {
                            log::warn!(
                                "Buffer push error for device {}: {}",
                                self.config.device_id,
                                e
                            );
                        }
                    }
                }
            }
            DataType::Float32 => {
                for chunk in data.chunks(2) {
                    if chunk.len() >= 2 {
                        let high = chunk[0] as u32;
                        let low = chunk[1] as u32;
                        let bits = (high << 16) | low;
                        let float_value = f32::from_bits(bits);

                        let data_point = DataPoint {
                            timestamp,
                            device_id: self.config.device_id.clone(),
                            register: reg_config.address,
                            value: float_value as i32,
                        };

                        if let Err(e) = self.buffer.push(data_point) {
                            log::warn!(
                                "Buffer push error for device {}: {}",
                                self.config.device_id,
                                e
                            );
                        }
                    }
                }
            }
        }
    }
}

enum PollError {
    Disconnected,
    Other(String),
}
