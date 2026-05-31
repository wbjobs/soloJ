use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

use chrono::{DateTime, Local};
use etherparse::{SlicedPacket, TransportSlice};
use pcap::{Active, Capture, Device, Error};

use crate::protocols::dns::{self, DnsInfo};
use crate::protocols::http::{self, HttpInfo};
use crate::protocols::tcp::{self, TcpFlags};
use crate::types::{PacketInfo, ProtocolType};

pub struct CaptureState {
    pub is_capturing: Arc<AtomicBool>,
    pub packet_count: Arc<Mutex<u64>>,
    pub capture_thread: Option<std::thread::JoinHandle<()>>,
}

impl CaptureState {
    pub fn new() -> Self {
        Self {
            is_capturing: Arc::new(AtomicBool::new(false)),
            packet_count: Arc::new(Mutex::new(0)),
            capture_thread: None,
        }
    }
}

pub fn get_interfaces() -> Result<Vec<crate::types::NetworkInterface>, String> {
    let devices = Device::list().map_err(|e| {
        format!(
            "无法获取网卡列表: {}。请确认已安装 Npcap/WinPcap 并以管理员权限运行程序。",
            e
        )
    })?;

    Ok(devices
        .into_iter()
        .map(|d| crate::types::NetworkInterface {
            name: d.name.clone(),
            description: d.desc.clone().unwrap_or_default(),
            addresses: d
                .addresses
                .into_iter()
                .map(|addr| addr.addr.to_string())
                .collect(),
        })
        .collect())
}

pub fn check_capture_available() -> Result<(), String> {
    match Device::list() {
        Ok(devices) if !devices.is_empty() => Ok(()),
        Ok(_) => Err("未检测到可用网卡。请确认网络适配器正常工作。".to_string()),
        Err(e) => {
            let msg = format!("{}", e).to_lowercase();
            if msg.contains("permission") || msg.contains("denied") || msg.contains("access") {
                Err("权限不足：请以管理员身份运行程序以捕获网络数据包。".to_string())
            } else if msg.contains("no such device")
                || msg.contains("not found")
                || msg.contains("dll")
                || msg.contains("library")
            {
                Err("未检测到 Npcap/WinPcap：请安装 Npcap (https://npcap.com) 后重试。".to_string())
            } else {
                Err(format!(
                    "无法初始化抓包引擎: {}。请确认已安装 Npcap/WinPcap 并以管理员权限运行。",
                    e
                ))
            }
        }
    }
}

pub fn start_capture<F>(
    interface_name: &str,
    window: tauri::Window,
    state: &CaptureState,
    packet_handler: F,
) -> Result<(), String>
where
    F: Fn(PacketInfo) + Send + 'static,
{
    if state.is_capturing.load(Ordering::Relaxed) {
        return Ok(());
    }

    let device = Device::list()
        .map_err(|e| format!("获取网卡列表失败: {}", e))?
        .into_iter()
        .find(|d| d.name == interface_name)
        .ok_or_else(|| "未找到指定网卡接口".to_string())?;

    let cap = Capture::from_device(device)
        .map_err(|e| {
            let msg = format!("{}", e).to_lowercase();
            if msg.contains("permission") || msg.contains("denied") || msg.contains("access") {
                "权限不足：请以管理员身份运行程序。".to_string()
            } else {
                format!("打开网卡设备失败: {}", e)
            }
        })?
        .promisc(true)
        .snaplen(65535)
        .timeout(1000)
        .open()
        .map_err(|e| {
            let msg = format!("{}", e).to_lowercase();
            if msg.contains("permission") || msg.contains("denied") || msg.contains("access") {
                "权限不足：请以管理员身份运行程序。".to_string()
            } else {
                format!("激活网卡捕获模式失败: {}", e)
            }
        })?;

    let mut cap = cap;
    cap.filter("tcp or udp port 53", true)
        .map_err(|e| format!("设置捕获过滤器失败: {}", e))?;

    state.is_capturing.store(true, Ordering::Relaxed);
    *state.packet_count.lock().unwrap() = 0;

    let is_capturing = state.is_capturing.clone();
    let packet_count = state.packet_count.clone();
    let interface_name = interface_name.to_string();

    std::thread::spawn(move || {
        println!("开始捕获数据包在接口: {}", interface_name);

        while is_capturing.load(Ordering::Relaxed) {
            match cap.next() {
                Ok(packet) => {
                    let count = {
                        let mut c = packet_count.lock().unwrap();
                        *c += 1;
                        *c
                    };

                    if let Some(packet_info) = parse_packet(&packet, count) {
                        let _ = window.emit("packet-received", &packet_info);
                        packet_handler(packet_info);
                    }
                }
                Err(Error::TimeoutExpired) => continue,
                Err(e) => {
                    let err_msg = format!("捕获数据包错误: {}", e);
                    eprintln!("{}", err_msg);
                    let _ = window.emit("capture-error", &err_msg);
                    break;
                }
            }
        }

        println!("停止捕获数据包在接口: {}", interface_name);
        is_capturing.store(false, Ordering::Relaxed);
        let _ = window.emit("capture-stopped", &());
    });

    Ok(())
}

pub fn stop_capture(state: &CaptureState) {
    state.is_capturing.store(false, Ordering::Relaxed);
}

fn parse_packet(packet: &pcap::Packet, id: u64) -> Option<PacketInfo> {
    let timestamp = DateTime::<Local>::from(SystemTime::now())
        .format("%H:%M:%S%.3f")
        .to_string();

    let length = packet.header.len as u32;

    let sliced = match SlicedPacket::from_ethernet(packet.data) {
        Ok(s) => s,
        Err(_) => return None,
    };

    let ip = match sliced.ip {
        Some(ip) => ip,
        None => return None,
    };

    let (source_ip, dest_ip) = match ip {
        etherparse::InternetSlice::Ipv4(v4) => (
            v4.source_addr().to_string(),
            v4.destination_addr().to_string(),
        ),
        etherparse::InternetSlice::Ipv6(v6) => (
            v6.source_addr().to_string(),
            v6.destination_addr().to_string(),
        ),
    };

    let transport = match sliced.transport {
        Some(t) => t,
        None => {
            return Some(PacketInfo {
                id,
                timestamp,
                protocol: ProtocolType::Other,
                source_ip,
                source_port: 0,
                dest_ip,
                dest_port: 0,
                length,
                info: "Unknown transport".to_string(),
                flags: None,
                http_method: None,
                http_path: None,
                dns_query: None,
                dns_type: None,
            });
        }
    };

    match transport {
        TransportSlice::Tcp(tcp) => {
            let source_port = tcp.source_port();
            let dest_port = tcp.destination_port();
            let flags = tcp::parse_tcp_flags(&tcp.to_header());
            let payload = tcp.payload();

            let mut protocol = ProtocolType::Tcp;
            let mut info = tcp::get_tcp_info(&flags, source_port, dest_port);
            let mut http_method: Option<String> = None;
            let mut http_path: Option<String> = None;

            if (http::is_http_port(source_port) || http::is_http_port(dest_port))
                && !payload.is_empty()
            {
                if let Some(http_info) = http::parse_http(payload) {
                    protocol = ProtocolType::Http;
                    info = http_info.info;
                    http_method = http_info.method;
                    http_path = http_info.path;
                }
            }

            Some(PacketInfo {
                id,
                timestamp,
                protocol,
                source_ip,
                source_port,
                dest_ip,
                dest_port,
                length,
                info,
                flags: Some(flags.to_string()),
                http_method,
                http_path,
                dns_query: None,
                dns_type: None,
            })
        }
        TransportSlice::Udp(udp) => {
            let source_port = udp.source_port();
            let dest_port = udp.destination_port();
            let payload = udp.payload();

            if dns::is_dns_port(source_port) || dns::is_dns_port(dest_port) {
                if let Some(dns_info) = dns::parse_dns(payload) {
                    return Some(PacketInfo {
                        id,
                        timestamp,
                        protocol: ProtocolType::Dns,
                        source_ip,
                        source_port,
                        dest_ip,
                        dest_port,
                        length,
                        info: dns_info.info,
                        flags: None,
                        http_method: None,
                        http_path: None,
                        dns_query: Some(dns_info.query),
                        dns_type: Some(dns_info.query_type),
                    });
                }
            }

            Some(PacketInfo {
                id,
                timestamp,
                protocol: ProtocolType::Other,
                source_ip,
                source_port,
                dest_ip,
                dest_port,
                length,
                info: format!("UDP {} → {}", source_port, dest_port),
                flags: None,
                http_method: None,
                http_path: None,
                dns_query: None,
                dns_type: None,
            })
        }
        _ => Some(PacketInfo {
            id,
            timestamp,
            protocol: ProtocolType::Other,
            source_ip,
            source_port: 0,
            dest_ip,
            dest_port: 0,
            length,
            info: "Other transport".to_string(),
            flags: None,
            http_method: None,
            http_path: None,
            dns_query: None,
            dns_type: None,
        }),
    }
}

#[allow(dead_code)]
fn set_filter(cap: &mut Capture<Active>, filter: &str) -> Result<(), Error> {
    cap.filter(filter, true)?;
    Ok(())
}
