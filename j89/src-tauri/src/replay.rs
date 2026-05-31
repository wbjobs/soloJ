use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{Duration, Instant};

use crate::types::{PacketInfo, ProtocolType, ReplayResult, ReplaySession, ReplayStatus};

static SESSION_COUNTER: AtomicU32 = AtomicU32::new(0);

const CONNECT_TIMEOUT_SECS: u64 = 5;
const READ_TIMEOUT_SECS: u64 = 5;
const MAX_RESPONSE_SIZE: usize = 65536;

pub fn replay_packets(packets: &[PacketInfo]) -> ReplaySession {
    let session_id = format!("replay-{}", SESSION_COUNTER.fetch_add(1, Ordering::Relaxed));

    let tcp_packets: Vec<&PacketInfo> = packets
        .iter()
        .filter(|p| p.protocol == ProtocolType::Tcp || p.protocol == ProtocolType::Http)
        .filter(|p| !is_pure_control_packet(p))
        .collect();

    if tcp_packets.is_empty() {
        return ReplaySession {
            id: session_id,
            total_packets: 0,
            results: vec![],
            status: ReplayStatus::Failed,
        };
    }

    let total = tcp_packets.len() as u32;
    let mut results = Vec::with_capacity(tcp_packets.len());

    for packet in &tcp_packets {
        let result = replay_single_packet(packet);
        results.push(result);
    }

    let all_failed = results.iter().all(|r| !r.success);

    ReplaySession {
        id: session_id,
        total_packets: total,
        results,
        status: if all_failed {
            ReplayStatus::Failed
        } else {
            ReplayStatus::Completed
        },
    }
}

fn is_pure_control_packet(packet: &PacketInfo) -> bool {
    if let Some(ref flags) = packet.flags {
        let flag_str = flags.to_uppercase();
        if flag_str.contains("SYN") && !flag_str.contains("PSH") && !flag_str.contains("ACK") {
            return true;
        }
        if flag_str.contains("FIN") {
            return true;
        }
        if flag_str.contains("RST") {
            return true;
        }
        if flag_str == "ACK" {
            return true;
        }
    }
    false
}

fn replay_single_packet(packet: &PacketInfo) -> ReplayResult {
    let addr = format!("{}:{}", packet.dest_ip, packet.dest_port);

    let socket_addrs = match addr.to_socket_addrs() {
        Ok(addrs) => addrs.collect::<Vec<_>>(),
        Err(e) => {
            return ReplayResult {
                packet_id: packet.id,
                dest_ip: packet.dest_ip.clone(),
                dest_port: packet.dest_port,
                success: false,
                response_summary: String::new(),
                response_time_ms: 0,
                error: Some(format!("地址解析失败: {}", e)),
            }
        }
    };

    let start = Instant::now();

    let mut stream = match TcpStream::connect_timeout(
        &socket_addrs.as_slice(),
        Duration::from_secs(CONNECT_TIMEOUT_SECS),
    ) {
        Ok(s) => s,
        Err(e) => {
            let elapsed = start.elapsed().as_millis() as u64;
            return ReplayResult {
                packet_id: packet.id,
                dest_ip: packet.dest_ip.clone(),
                dest_port: packet.dest_port,
                success: false,
                response_summary: String::new(),
                response_time_ms: elapsed,
                error: Some(format!("连接失败: {}", e)),
            };
        }
    };

    if let Err(e) = stream.set_read_timeout(Some(Duration::from_secs(READ_TIMEOUT_SECS))) {
        let elapsed = start.elapsed().as_millis() as u64;
        return ReplayResult {
            packet_id: packet.id,
            dest_ip: packet.dest_ip.clone(),
            dest_port: packet.dest_port,
            success: false,
            response_summary: String::new(),
            response_time_ms: elapsed,
            error: Some(format!("设置读取超时失败: {}", e)),
        };
    }

    let payload = reconstruct_payload(packet);

    if !payload.is_empty() {
        if let Err(e) = stream.write_all(&payload) {
            let elapsed = start.elapsed().as_millis() as u64;
            return ReplayResult {
                packet_id: packet.id,
                dest_ip: packet.dest_ip.clone(),
                dest_port: packet.dest_port,
                success: false,
                response_summary: String::new(),
                response_time_ms: elapsed,
                error: Some(format!("发送数据失败: {}", e)),
            };
        }
        if let Err(e) = stream.flush() {
            let elapsed = start.elapsed().as_millis() as u64;
            return ReplayResult {
                packet_id: packet.id,
                dest_ip: packet.dest_ip.clone(),
                dest_port: packet.dest_port,
                success: false,
                response_summary: String::new(),
                response_time_ms: elapsed,
                error: Some(format!("刷新发送缓冲区失败: {}", e)),
            };
        }
    }

    let mut response_buf = vec![0u8; MAX_RESPONSE_SIZE];
    let response_summary = match stream.read(&mut response_buf) {
        Ok(0) => "连接已关闭（无响应数据）".to_string(),
        Ok(n) => {
            let data = &response_buf[..n];
            summarize_response(data)
        }
        Err(e) => format!("读取响应超时或失败: {}", e),
    };

    let elapsed = start.elapsed().as_millis() as u64;

    let success = !response_summary.starts_with("读取响应超时")
        && !response_summary.starts_with("连接已关闭");

    ReplayResult {
        packet_id: packet.id,
        dest_ip: packet.dest_ip.clone(),
        dest_port: packet.dest_port,
        success,
        response_summary,
        response_time_ms: elapsed,
        error: None,
    }
}

fn reconstruct_payload(packet: &PacketInfo) -> Vec<u8> {
    if packet.protocol == ProtocolType::Http {
        let mut payload = String::new();

        if let Some(ref method) = packet.http_method {
            payload.push_str(method);
            payload.push(' ');
        }

        if let Some(ref path) = packet.http_path {
            payload.push_str(path);
        } else {
            payload.push('/');
        }

        payload.push_str(" HTTP/1.1\r\n");
        payload.push_str(&format!("Host: {}\r\n", packet.dest_ip));
        payload.push_str("Connection: close\r\n");
        payload.push_str("User-Agent: NetworkAnalyzer/1.0\r\n");
        payload.push_str("\r\n");

        return payload.into_bytes();
    }

    Vec::new()
}

fn summarize_response(data: &[u8]) -> String {
    let text = String::from_utf8_lossy(data);

    if text.starts_with("HTTP/") {
        let first_line = text.lines().next().unwrap_or("");
        let body_start = text.find("\r\n\r\n").unwrap_or(0);
        let body_len = data.len().saturating_sub(body_start + 4);
        format!("{} | 响应体: {} 字节", first_line, body_len)
    } else {
        let display_len = data.len().min(64);
        let preview = &text[..display_len.min(text.len())];
        format!("{} 字节响应: {}...", data.len(), preview.trim())
    }
}
