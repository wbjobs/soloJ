#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod serial_port;
mod logger;
mod replay;

use parking_lot::Mutex;
use replay::*;
use serial_port::{self, *};
use logger::Logger;
use std::sync::Arc;
use tauri::Manager;

struct AppState {
    serial_state: SerialPortState,
    logger: Arc<Mutex<Logger>>,
    replay_state: ReplayState,
}

#[tauri::command]
fn get_ports() -> Result<Vec<String>, String> {
    get_available_ports()
}

#[tauri::command]
fn open_port(state: tauri::State<AppState>, config: SerialConfig) -> Result<(), String> {
    open_serial_port(&state.serial_state, &config)
}

#[tauri::command]
fn close_port(state: tauri::State<AppState>) -> Result<(), String> {
    close_serial_port(&state.serial_state)
}

#[tauri::command]
fn send_command(
    state: tauri::State<AppState>,
    hex_command: String,
) -> Result<LogEntry, String> {
    let entry = enqueue_hex_command(&state.serial_state, &hex_command)?;
    
    let mut logger = state.logger.lock();
    let _ = logger.log_entry(&entry);
    
    Ok(entry)
}

#[tauri::command]
fn get_queue_size(state: tauri::State<AppState>) -> Result<usize, String> {
    serial_port::get_queue_size(&state.serial_state)
}

#[tauri::command]
fn read_data(state: tauri::State<AppState>) -> Result<Option<LogEntry>, String> {
    let result = read_serial_data(&state.serial_state)?;
    
    if let Some(entry) = &result {
        let mut logger = state.logger.lock();
        let _ = logger.log_entry(&entry);
    }
    
    Ok(result)
}

#[tauri::command]
fn is_open(state: tauri::State<AppState>) -> bool {
    is_port_open(&state.serial_state)
}

#[tauri::command]
fn start_logging(
    state: tauri::State<AppState>,
    log_dir: String,
) -> Result<String, String> {
    let mut logger = state.logger.lock();
    logger.create_new_log(&log_dir)
}

#[tauri::command]
fn stop_logging(state: tauri::State<AppState>) -> Result<(), String> {
    let mut logger = state.logger.lock();
    logger.close();
    Ok(())
}

#[tauri::command]
fn get_log_path(state: tauri::State<AppState>) -> Option<String> {
    let logger = state.logger.lock();
    logger.get_current_log_path()
}

#[tauri::command]
fn parse_log(file_path: String) -> Result<Vec<ReplayCommand>, String> {
    parse_log_file(&file_path)
}

#[tauri::command]
fn start_replay_cmd(
    state: tauri::State<AppState>,
    app_handle: tauri::AppHandle,
    commands: Vec<ReplayCommand>,
) -> Result<(), String> {
    start_replay(
        &state.replay_state,
        &state.serial_state,
        commands,
        app_handle,
    )
}

#[tauri::command]
fn stop_replay_cmd(state: tauri::State<AppState>) -> Result<(), String> {
    stop_replay(&state.replay_state)
}

#[tauri::command]
fn pause_replay_cmd(state: tauri::State<AppState>) -> Result<(), String> {
    pause_replay(&state.replay_state)
}

#[tauri::command]
fn resume_replay_cmd(state: tauri::State<AppState>) -> Result<(), String> {
    resume_replay(&state.replay_state)
}

#[tauri::command]
fn get_replay_status_cmd(state: tauri::State<AppState>) -> ReplayStatus {
    state.replay_state.get_status()
}

#[tauri::command]
fn update_delay(
    state: tauri::State<AppState>,
    index: usize,
    delay_ms: u64,
) -> Result<(), String> {
    update_command_delay(&state.replay_state, index, delay_ms)
}

fn main() {
    let app_state = AppState {
        serial_state: SerialPortState::new(),
        logger: Arc::new(Mutex::new(Logger::new())),
        replay_state: ReplayState::new(),
    };

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_ports,
            open_port,
            close_port,
            send_command,
            read_data,
            is_open,
            start_logging,
            stop_logging,
            get_log_path,
            get_queue_size,
            parse_log,
            start_replay_cmd,
            stop_replay_cmd,
            pause_replay_cmd,
            resume_replay_cmd,
            get_replay_status_cmd,
            update_delay
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
