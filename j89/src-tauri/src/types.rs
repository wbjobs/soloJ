use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NetworkInterface {
    pub name: String,
    pub description: String,
    pub addresses: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum ProtocolType {
    Http,
    Dns,
    Tcp,
    Other,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PacketInfo {
    pub id: u64,
    pub timestamp: String,
    pub protocol: ProtocolType,
    pub source_ip: String,
    pub source_port: u16,
    pub dest_ip: String,
    pub dest_port: u16,
    pub length: u32,
    pub info: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flags: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub http_method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub http_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dns_query: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dns_type: Option<String>,
}

#[derive(Debug)]
pub struct TcpFlags {
    pub syn: bool,
    pub ack: bool,
    pub fin: bool,
    pub rst: bool,
    pub psh: bool,
    pub urg: bool,
}

impl TcpFlags {
    pub fn to_string(&self) -> String {
        let mut flags = Vec::new();
        if self.syn {
            flags.push("SYN");
        }
        if self.ack {
            flags.push("ACK");
        }
        if self.fin {
            flags.push("FIN");
        }
        if self.rst {
            flags.push("RST");
        }
        if self.psh {
            flags.push("PSH");
        }
        if self.urg {
            flags.push("URG");
        }
        flags.join(",")
    }

    pub fn is_handshake(&self) -> bool {
        (self.syn && !self.ack) || (self.syn && self.ack) || (self.fin && self.ack)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CaptureStatus {
    pub is_capturing: bool,
    pub selected_interface: Option<String>,
    pub packet_count: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReplayRequest {
    pub packets: Vec<PacketInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReplayResult {
    pub packet_id: u64,
    pub dest_ip: String,
    pub dest_port: u16,
    pub success: bool,
    pub response_summary: String,
    pub response_time_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReplaySession {
    pub id: String,
    pub total_packets: u32,
    pub results: Vec<ReplayResult>,
    pub status: ReplayStatus,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum ReplayStatus {
    Pending,
    Running,
    Completed,
    Failed,
}
