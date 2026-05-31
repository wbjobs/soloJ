use crate::serial_port::{enqueue_hex_command, LogEntry, SerialPortState};
use chrono::Local;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager, Window};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplayCommand {
    pub index: usize,
    pub hex_data: String,
    pub ascii_data: String,
    pub delay_ms: u64,
    pub original_timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplayStatus {
    pub is_running: bool,
    pub is_paused: bool,
    pub current_index: usize,
    pub total_commands: usize,
    pub current_command: Option<ReplayCommand>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplayEvent {
    pub event_type: String,
    pub index: usize,
    pub total: usize,
    pub hex_data: String,
    pub log_entry: Option<LogEntry>,
}

pub struct ReplayState {
    pub commands: Arc<Mutex<Vec<ReplayCommand>>>,
    pub is_running: Arc<AtomicBool>,
    pub is_paused: Arc<AtomicBool>,
    pub current_index: Arc<AtomicUsize>,
    pub stop_flag: Arc<AtomicBool>,
    pub app_handle: Option<AppHandle>,
}

impl ReplayState {
    pub fn new() -> Self {
        ReplayState {
            commands: Arc::new(Mutex::new(Vec::new())),
            is_running: Arc::new(AtomicBool::new(false)),
            is_paused: Arc::new(AtomicBool::new(false)),
            current_index: Arc::new(AtomicUsize::new(0)),
            stop_flag: Arc::new(AtomicBool::new(false)),
            app_handle: None,
        }
    }

    pub fn get_status(&self) -> ReplayStatus {
        let commands = self.commands.lock();
        let idx = self.current_index.load(Ordering::SeqCst);
        ReplayStatus {
            is_running: self.is_running.load(Ordering::SeqCst),
            is_paused: self.is_paused.load(Ordering::SeqCst),
            current_index: idx,
            total_commands: commands.len(),
            current_command: commands.get(idx).cloned(),
        }
    }
}

pub fn parse_log_file(file_path: &str) -> Result<Vec<ReplayCommand>, String> {
    let content = fs::read_to_string(file_path).map_err(|e| format!("读取文件失败: {}", e))?;
    
    let mut tx_entries: Vec<(String, String)> = Vec::new();
    
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('=') || trimmed.starts_with('串') || trimmed.starts_with('创建') || trimmed.starts_with('格式') {
            continue;
        }
        
        if !trimmed.contains("[TX]") {
            continue;
        }
        
        let hex_data = extract_hex_from_line(trimmed);
        let timestamp = extract_timestamp_from_line(trimmed);
        
        if !hex_data.is_empty() {
            tx_entries.push((timestamp, hex_data));
        }
    }
    
    if tx_entries.is_empty() {
        return Err("日志文件中未找到发送(TX)指令".to_string());
    }
    
    let mut commands = Vec::new();
    for (i, (timestamp, hex_data)) in tx_entries.iter().enumerate() {
        let delay_ms = if i == 0 {
            500
        } else {
            calculate_delay(&tx_entries[i - 1].0, timestamp)
        };
        
        let bytes = hex::decode(hex_data.replace(" ", "")).unwrap_or_default();
        let ascii = bytes
            .iter()
            .map(|&b| if b.is_ascii_printable() { b as char } else { '.' })
            .collect::<String>();
        
        commands.push(ReplayCommand {
            index: i,
            hex_data: hex_data.clone(),
            ascii_data: ascii,
            delay_ms,
            original_timestamp: timestamp.clone(),
        });
    }
    
    Ok(commands)
}

fn extract_hex_from_line(line: &str) -> String {
    if let Some(hex_part) = line.find("HEX: ") {
        let rest = &line[hex_part + 5..];
        if let Some(ascii_pos) = rest.find(" ASCII:") {
            rest[..ascii_pos].trim().to_string()
        } else {
            rest.trim().to_string()
        }
    } else {
        String::new()
    }
}

fn extract_timestamp_from_line(line: &str) -> String {
    if let Some(start) = line.find('[') {
        if let Some(end) = line[start + 1..].find(']') {
            return line[start + 1..start + 1 + end].to_string();
        }
    }
    String::new()
}

fn calculate_delay(prev_timestamp: &str, curr_timestamp: &str) -> u64 {
    let prev = parse_timestamp_ms(prev_timestamp);
    let curr = parse_timestamp_ms(curr_timestamp);
    
    if prev > 0 && curr > prev {
        let diff = curr - prev;
        diff.min(30000)
    } else {
        500
    }
}

fn parse_timestamp_ms(ts: &str) -> u64 {
    let parts: Vec<&str> = ts.split('.').collect();
    if parts.len() != 2 {
        return 0;
    }
    
    let date_time_part = parts[0];
    let ms_part = parts[1];
    
    let dt_parts: Vec<&str> = date_time_part.split(&['-', ' ', ':'][..]).collect();
    if dt_parts.len() < 6 {
        return 0;
    }
    
    let year: u64 = dt_parts[0].parse().unwrap_or(0);
    let month: u64 = dt_parts[1].parse().unwrap_or(0);
    let day: u64 = dt_parts[2].parse().unwrap_or(0);
    let hour: u64 = dt_parts[3].parse().unwrap_or(0);
    let minute: u64 = dt_parts[4].parse().unwrap_or(0);
    let second: u64 = dt_parts[5].parse().unwrap_or(0);
    let ms: u64 = ms_part.parse().unwrap_or(0);
    
    let total_ms = year * 365 * 24 * 3600 * 1000
        + month * 30 * 24 * 3600 * 1000
        + day * 24 * 3600 * 1000
        + hour * 3600 * 1000
        + minute * 60 * 1000
        + second * 1000
        + ms;
    
    total_ms
}

pub fn start_replay(
    replay_state: &ReplayState,
    serial_state: &SerialPortState,
    commands: Vec<ReplayCommand>,
    app_handle: AppHandle,
) -> Result<(), String> {
    if replay_state.is_running.load(Ordering::SeqCst) {
        return Err("回放正在运行中".to_string());
    }
    
    if commands.is_empty() {
        return Err("指令序列为空".to_string());
    }
    
    if serial_state.port.lock().is_none() {
        return Err("串口未打开，请先打开串口".to_string());
    }
    
    let total = commands.len();
    *replay_state.commands.lock() = commands.clone();
    replay_state.is_running.store(true, Ordering::SeqCst);
    replay_state.is_paused.store(false, Ordering::SeqCst);
    replay_state.current_index.store(0, Ordering::SeqCst);
    replay_state.stop_flag.store(false, Ordering::SeqCst);
    
    let is_running = replay_state.is_running.clone();
    let is_paused = replay_state.is_paused.clone();
    let current_index = replay_state.current_index.clone();
    let stop_flag = replay_state.stop_flag.clone();
    let tx_sender = serial_state.tx_sender.clone();
    let logger = Arc::new(Mutex::new(crate::logger::Logger::new()));
    
    let handle = app_handle.clone();
    
    thread::spawn(move || {
        for (i, cmd) in commands.iter().enumerate() {
            if stop_flag.load(Ordering::SeqCst) {
                break;
            }
            
            while is_paused.load(Ordering::SeqCst) && !stop_flag.load(Ordering::SeqCst) {
                thread::sleep(Duration::from_millis(50));
            }
            
            if stop_flag.load(Ordering::SeqCst) {
                break;
            }
            
            current_index.store(i, Ordering::SeqCst);
            
            if i > 0 {
                let delay = cmd.delay_ms;
                let step = 50;
                let mut elapsed = 0u64;
                while elapsed < delay {
                    if stop_flag.load(Ordering::SeqCst) {
                        break;
                    }
                    let sleep_time = step.min(delay - elapsed);
                    thread::sleep(Duration::from_millis(sleep_time));
                    elapsed += sleep_time;
                    
                    while is_paused.load(Ordering::SeqCst) && !stop_flag.load(Ordering::SeqCst) {
                        thread::sleep(Duration::from_millis(50));
                    }
                }
            }
            
            if stop_flag.load(Ordering::SeqCst) {
                break;
            }
            
            let hex_clean = cmd.hex_data.replace(" ", "").replace("\n", "");
            if let Ok(bytes) = hex::decode(&hex_clean) {
                let sender_lock = tx_sender.lock();
                if let Some(sender) = sender_lock.as_ref() {
                    if sender.send(bytes.clone()).is_err() {
                        break;
                    }
                } else {
                    break;
                }
                drop(sender_lock);
                
                let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
                let ascii = bytes
                    .iter()
                    .map(|&b| if b.is_ascii_printable() { b as char } else { '.' })
                    .collect::<String>();
                
                let log_entry = LogEntry {
                    timestamp: timestamp.clone(),
                    direction: "TX".to_string(),
                    hex_data: hex::encode_upper(&bytes),
                    ascii_data: ascii,
                };
                
                if let Ok(mut lg) = logger.lock() {
                    let _ = lg.log_entry(&log_entry);
                }
                
                let event = ReplayEvent {
                    event_type: "replay-step".to_string(),
                    index: i,
                    total,
                    hex_data: cmd.hex_data.clone(),
                    log_entry: Some(log_entry),
                };
                let _ = handle.emit_all("replay-event", &event);
            }
        }
        
        is_running.store(false, Ordering::SeqCst);
        current_index.store(0, Ordering::SeqCst);
        
        let end_event = ReplayEvent {
            event_type: "replay-done".to_string(),
            index: 0,
            total,
            hex_data: String::new(),
            log_entry: None,
        };
        let _ = handle.emit_all("replay-event", &end_event);
    });
    
    Ok(())
}

pub fn stop_replay(replay_state: &ReplayState) -> Result<(), String> {
    if !replay_state.is_running.load(Ordering::SeqCst) {
        return Err("没有正在运行的回放".to_string());
    }
    
    replay_state.stop_flag.store(true, Ordering::SeqCst);
    replay_state.is_paused.store(false, Ordering::SeqCst);
    
    Ok(())
}

pub fn pause_replay(replay_state: &ReplayState) -> Result<(), String> {
    if !replay_state.is_running.load(Ordering::SeqCst) {
        return Err("没有正在运行的回放".to_string());
    }
    if replay_state.is_paused.load(Ordering::SeqCst) {
        return Err("回放已处于暂停状态".to_string());
    }
    
    replay_state.is_paused.store(true, Ordering::SeqCst);
    Ok(())
}

pub fn resume_replay(replay_state: &ReplayState) -> Result<(), String> {
    if !replay_state.is_running.load(Ordering::SeqCst) {
        return Err("没有正在运行的回放".to_string());
    }
    if !replay_state.is_paused.load(Ordering::SeqCst) {
        return Err("回放未暂停".to_string());
    }
    
    replay_state.is_paused.store(false, Ordering::SeqCst);
    Ok(())
}

pub fn update_command_delay(
    replay_state: &ReplayState,
    index: usize,
    delay_ms: u64,
) -> Result<(), String> {
    let mut commands = replay_state.commands.lock();
    if index >= commands.len() {
        return Err("指令索引超出范围".to_string());
    }
    commands[index].delay_ms = delay_ms;
    Ok(())
}
