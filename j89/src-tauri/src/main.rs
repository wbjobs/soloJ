#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod capture;
mod protocols;
mod replay;
mod types;

use std::sync::Mutex;

use capture::CaptureState;
use types::{PacketInfo, ReplaySession};

struct AppState {
    capture: Mutex<CaptureState>,
    selected_interface: Mutex<Option<String>>,
    packets: Mutex<Vec<PacketInfo>>,
    replay_sessions: Mutex<Vec<ReplaySession>>,
}

impl AppState {
    fn new() -> Self {
        Self {
            capture: Mutex::new(CaptureState::new()),
            selected_interface: Mutex::new(None),
            packets: Mutex::new(Vec::new()),
            replay_sessions: Mutex::new(Vec::new()),
        }
    }
}

#[tauri::command]
fn get_interfaces() -> Result<Vec<types::NetworkInterface>, String> {
    capture::get_interfaces()
}

#[tauri::command]
fn check_capture_available() -> Result<(), String> {
    capture::check_capture_available()
}

#[tauri::command]
fn start_capture(
    interface_name: String,
    window: tauri::Window,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let mut capture_state = state.capture.lock().unwrap();

    if capture_state
        .is_capturing
        .load(std::sync::atomic::Ordering::Relaxed)
    {
        return Err("已经在捕获中".to_string());
    }

    *state.selected_interface.lock().unwrap() = Some(interface_name.clone());
    state.packets.lock().unwrap().clear();

    let packets = state.packets.clone();

    capture::start_capture(&interface_name, window, &capture_state, move |packet| {
        packets.lock().unwrap().push(packet);
    })?;

    Ok(())
}

#[tauri::command]
fn stop_capture(state: tauri::State<AppState>) -> Result<(), String> {
    let capture_state = state.capture.lock().unwrap();
    capture::stop_capture(&capture_state);
    Ok(())
}

#[tauri::command]
fn get_capture_status(state: tauri::State<AppState>) -> types::CaptureStatus {
    let capture_state = state.capture.lock().unwrap();
    types::CaptureStatus {
        is_capturing: capture_state
            .is_capturing
            .load(std::sync::atomic::Ordering::Relaxed),
        selected_interface: state.selected_interface.lock().unwrap().clone(),
        packet_count: *capture_state.packet_count.lock().unwrap(),
    }
}

#[tauri::command]
fn get_packets(state: tauri::State<AppState>) -> Vec<PacketInfo> {
    state.packets.lock().unwrap().clone()
}

#[tauri::command]
fn clear_packets(state: tauri::State<AppState>) {
    state.packets.lock().unwrap().clear();
}

#[tauri::command]
fn replay_packets(
    window: tauri::Window,
    state: tauri::State<AppState>,
    packet_ids: Vec<u64>,
) -> Result<String, String> {
    let all_packets = state.packets.lock().unwrap().clone();
    let selected: Vec<PacketInfo> = all_packets
        .into_iter()
        .filter(|p| packet_ids.contains(&p.id))
        .collect();

    if selected.is_empty() {
        return Err("未找到选中的数据包".to_string());
    }

    let non_tcp = selected
        .iter()
        .filter(|p| {
            p.protocol != types::ProtocolType::Tcp && p.protocol != types::ProtocolType::Http
        })
        .count();

    if non_tcp == selected.len() {
        return Err("选中的数据包中没有 TCP/HTTP 协议包，无法重放".to_string());
    }

    let replayable: Vec<PacketInfo> = selected
        .into_iter()
        .filter(|p| {
            p.protocol == types::ProtocolType::Tcp || p.protocol == types::ProtocolType::Http
        })
        .collect();

    let count = replayable.len();
    let packets_clone = replayable.clone();

    std::thread::spawn(move || {
        let _ = window.emit("replay-started", &count);

        let session = replay::replay_packets(&packets_clone);

        let _ = window.emit("replay-completed", &session);
    });

    Ok(format!("已开始重放 {} 个数据包", count))
}

#[tauri::command]
fn get_replay_sessions(state: tauri::State<AppState>) -> Vec<ReplaySession> {
    state.replay_sessions.lock().unwrap().clone()
}

fn main() {
    let state = AppState::new();

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            get_interfaces,
            check_capture_available,
            start_capture,
            stop_capture,
            get_capture_status,
            get_packets,
            clear_packets,
            replay_packets,
            get_replay_sessions
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("应用启动错误: {}", e);
        });
}
