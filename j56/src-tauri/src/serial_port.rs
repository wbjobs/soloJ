use chrono::Local;
use hex;
use parking_lot::Mutex;
use serialport::*;
use std::io::Write;
use std::panic::catch_unwind;
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::Duration;

type SharedPort = Arc<Mutex<Option<Box<dyn SerialPort>>>>;

pub struct SerialPortState {
    pub port: SharedPort,
    pub tx_sender: Arc<Mutex<Option<Sender<Vec<u8>>>>>,
    pub worker_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
}

impl SerialPortState {
    pub fn new() -> Self {
        SerialPortState {
            port: Arc::new(Mutex::new(None)),
            tx_sender: Arc::new(Mutex::new(None)),
            worker_handle: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SerialConfig {
    pub port_name: String,
    pub baud_rate: u32,
    pub data_bits: u8,
    pub stop_bits: u8,
    pub parity: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub direction: String,
    pub hex_data: String,
    pub ascii_data: String,
}

pub fn get_available_ports() -> Result<Vec<String>, String> {
    let ports = serialport::available_ports().map_err(|e| e.to_string())?;
    Ok(ports.into_iter().map(|p| p.port_name).collect())
}

pub fn open_serial_port(
    state: &SerialPortState,
    config: &SerialConfig,
) -> Result<(), String> {
    close_serial_port(state).ok();

    let parity = match config.parity.as_str() {
        "None" => Parity::None,
        "Odd" => Parity::Odd,
        "Even" => Parity::Even,
        _ => Parity::None,
    };

    let stop_bits = match config.stop_bits {
        1 => StopBits::One,
        2 => StopBits::Two,
        _ => StopBits::One,
    };

    let data_bits = match config.data_bits {
        5 => DataBits::Five,
        6 => DataBits::Six,
        7 => DataBits::Seven,
        8 => DataBits::Eight,
        _ => DataBits::Eight,
    };

    let port_result = catch_unwind(|| {
        serialport::new(&config.port_name, config.baud_rate)
            .data_bits(data_bits)
            .parity(parity)
            .stop_bits(stop_bits)
            .timeout(Duration::from_millis(100))
            .open()
    });

    let port = match port_result {
        Ok(Ok(p)) => p,
        Ok(Err(e)) => return Err(format!("打开串口失败: {}", e)),
        Err(_) => return Err("打开串口时发生错误: 串口可能被占用或不存在".to_string()),
    };

    let (tx_sender, tx_receiver) = mpsc::channel::<Vec<u8>>();
    
    *state.port.lock() = Some(port);
    
    let port_clone = state.port.clone();

    let handle = thread::spawn(move || {
        tx_worker_thread(tx_receiver, port_clone);
    });

    *state.tx_sender.lock() = Some(tx_sender);
    *state.worker_handle.lock() = Some(handle);
    
    Ok(())
}

fn tx_worker_thread(rx: Receiver<Vec<u8>>, port: SharedPort) {
    while let Ok(bytes) = rx.recv() {
        let mut port_lock = port.lock();
        if let Some(ref mut p) = *port_lock {
            if let Err(e) = p.write_all(&bytes) {
                eprintln!("发送数据失败: {}", e);
            }
            drop(port_lock);
            thread::sleep(Duration::from_millis(10));
        } else {
            break;
        }
    }
}

pub fn close_serial_port(state: &SerialPortState) -> Result<(), String> {
    *state.tx_sender.lock() = None;
    
    if let Some(handle) = state.worker_handle.lock().take() {
        thread::sleep(Duration::from_millis(50));
    }
    
    *state.port.lock() = None;
    *state.worker_handle.lock() = None;
    
    Ok(())
}

pub fn enqueue_hex_command(
    state: &SerialPortState,
    hex_str: &str,
) -> Result<LogEntry, String> {
    let hex_clean = hex_str.replace(" ", "").replace("\n", "");
    let bytes = hex::decode(&hex_clean).map_err(|e| e.to_string())?;

    let sender_lock = state.tx_sender.lock();
    let sender = sender_lock.as_ref().ok_or("串口未打开或发送队列未就绪")?;

    sender.send(bytes.clone()).map_err(|e| e.to_string())?;

    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
    let ascii = bytes_to_ascii(&bytes);

    Ok(LogEntry {
        timestamp,
        direction: "TX".to_string(),
        hex_data: hex::encode_upper(&bytes),
        ascii_data: ascii,
    })
}

pub fn send_hex_command(
    state: &SerialPortState,
    hex_str: &str,
) -> Result<LogEntry, String> {
    enqueue_hex_command(state, hex_str)
}

pub fn read_serial_data(state: &SerialPortState) -> Result<Option<LogEntry>, String> {
    let mut port_lock = state.port.lock();
    let port = match port_lock.as_mut() {
        Some(p) => p,
        None => return Ok(None),
    };

    let mut buffer = vec![0; 1024];
    let read_result = catch_unwind(std::panic::AssertUnwindSafe(|| {
        port.read(&mut buffer)
    }));

    match read_result {
        Ok(Ok(bytes_read)) if bytes_read > 0 => {
            let data = &buffer[..bytes_read];
            let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
            let ascii = bytes_to_ascii(data);

            Ok(Some(LogEntry {
                timestamp,
                direction: "RX".to_string(),
                hex_data: hex::encode_upper(data),
                ascii_data: ascii,
            }))
        }
        Ok(Ok(_)) => Ok(None),
        Ok(Err(e)) => {
            if e.kind() == std::io::ErrorKind::TimedOut {
                Ok(None)
            } else {
                Err(e.to_string())
            }
        }
        Err(_) => Err("读取串口数据时发生严重错误".to_string()),
    }
}

fn bytes_to_ascii(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|&b| {
            if b.is_ascii_printable() {
                b as char
            } else {
                '.'
            }
        })
        .collect()
}

pub fn is_port_open(state: &SerialPortState) -> bool {
    state.port.lock().is_some()
}

pub fn get_queue_size(state: &SerialPortState) -> Result<usize, String> {
    let sender_lock = state.tx_sender.lock();
    if let Some(sender) = sender_lock.as_ref() {
        Ok(0)
    } else {
        Err("串口未打开".to_string())
    }
}