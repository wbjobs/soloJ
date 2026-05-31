use std::net::SocketAddr;
use std::time::{Duration, Instant};

use crate::config::ProtocolConfig;
use crate::packet::{Packet, PacketType, SeqNum};
use crate::rto::RtoCalculator;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionState {
    Closed,
    SynSent,
    SynRecv,
    Established,
    FinSent,
    FinRecv,
    CloseWait,
    Closing,
    LastAck,
    TimeWait,
}

pub struct Connection {
    pub state: ConnectionState,
    pub local_addr: SocketAddr,
    pub remote_addr: Option<SocketAddr>,
    pub local_isn: SeqNum,
    pub remote_isn: SeqNum,
    pub local_window: u32,
    pub remote_window: u32,
    pub last_activity: Instant,
    handshake_timeout: Duration,
    max_retries: u32,
    retry_count: u32,
    rto_calc: RtoCalculator,
}

impl Connection {
    pub fn new_client(
        local_addr: SocketAddr,
        config: &ProtocolConfig,
    ) -> Self {
        let initial_rto = Duration::from_millis(config.initial_rto_ms);
        let min_rto = Duration::from_millis(config.min_rto_ms);
        let max_rto = Duration::from_millis(config.max_rto_ms);

        Connection {
            state: ConnectionState::Closed,
            local_addr,
            remote_addr: None,
            local_isn: rand::random::<u32>(),
            remote_isn: 0,
            local_window: config.initial_window,
            remote_window: config.initial_window,
            last_activity: Instant::now(),
            handshake_timeout: Duration::from_millis(config.handshake_timeout_ms),
            max_retries: config.max_retries,
            retry_count: 0,
            rto_calc: RtoCalculator::new(initial_rto, min_rto, max_rto),
        }
    }

    pub fn new_server(
        local_addr: SocketAddr,
        config: &ProtocolConfig,
    ) -> Self {
        let initial_rto = Duration::from_millis(config.initial_rto_ms);
        let min_rto = Duration::from_millis(config.min_rto_ms);
        let max_rto = Duration::from_millis(config.max_rto_ms);

        Connection {
            state: ConnectionState::Closed,
            local_addr,
            remote_addr: None,
            local_isn: rand::random::<u32>(),
            remote_isn: 0,
            local_window: config.initial_window,
            remote_window: config.initial_window,
            last_activity: Instant::now(),
            handshake_timeout: Duration::from_millis(config.handshake_timeout_ms),
            max_retries: config.max_retries,
            retry_count: 0,
            rto_calc: RtoCalculator::new(initial_rto, min_rto, max_rto),
        }
    }

    pub fn connect(&mut self, remote_addr: SocketAddr) -> Packet {
        self.remote_addr = Some(remote_addr);
        self.state = ConnectionState::SynSent;
        self.last_activity = Instant::now();
        self.retry_count = 0;
        Packet::new_syn(self.local_isn, self.local_window)
    }

    pub fn handle_syn(&mut self, packet: &Packet, remote_addr: SocketAddr) -> Option<Packet> {
        if self.state != ConnectionState::Closed && self.state != ConnectionState::SynSent {
            return None;
        }

        self.remote_addr = Some(remote_addr);
        self.remote_isn = packet.seq_num;
        self.remote_window = packet.window_size;
        self.state = ConnectionState::SynRecv;
        self.last_activity = Instant::now();
        self.retry_count = 0;

        Some(Packet::new_synack(
            self.local_isn,
            self.remote_isn.wrapping_add(1),
            self.local_window,
        ))
    }

    pub fn handle_synack(&mut self, packet: &Packet) -> Option<Packet> {
        if self.state != ConnectionState::SynSent {
            return None;
        }

        self.remote_isn = packet.seq_num;
        self.remote_window = packet.window_size;
        self.state = ConnectionState::Established;
        self.last_activity = Instant::now();

        Some(Packet::new_ack(
            self.remote_isn.wrapping_add(1),
            self.local_window,
        ))
    }

    pub fn handle_ack(&mut self, packet: &Packet) -> bool {
        match self.state {
            ConnectionState::SynRecv => {
                if packet.ack_num == self.local_isn.wrapping_add(1) {
                    self.state = ConnectionState::Established;
                    self.remote_window = packet.window_size;
                    self.last_activity = Instant::now();
                    return true;
                }
            }
            ConnectionState::Established => {
                self.remote_window = packet.window_size;
                self.last_activity = Instant::now();
                return true;
            }
            _ => {}
        }
        false
    }

    pub fn initiate_close(&mut self) -> Packet {
        self.state = ConnectionState::FinSent;
        self.last_activity = Instant::now();
        Packet::new_fin(self.local_isn, self.local_window)
    }

    pub fn handle_fin(&mut self, packet: &Packet) -> Packet {
        self.remote_window = packet.window_size;
        match self.state {
            ConnectionState::Established => {
                self.state = ConnectionState::CloseWait;
            }
            ConnectionState::FinSent => {
                self.state = ConnectionState::Closing;
            }
            _ => {}
        }
        self.last_activity = Instant::now();
        Packet::new_finack(
            self.local_isn,
            packet.seq_num.wrapping_add(1),
            self.local_window,
        )
    }

    pub fn handle_finack(&mut self, packet: &Packet) -> Option<Packet> {
        self.remote_window = packet.window_size;
        match self.state {
            ConnectionState::FinSent => {
                self.state = ConnectionState::TimeWait;
                self.last_activity = Instant::now();
                Some(Packet::new_ack(
                    packet.seq_num.wrapping_add(1),
                    self.local_window,
                ))
            }
            ConnectionState::Closing => {
                self.state = ConnectionState::TimeWait;
                self.last_activity = Instant::now();
                None
            }
            ConnectionState::LastAck => {
                self.state = ConnectionState::Closed;
                None
            }
            _ => None,
        }
    }

    pub fn is_established(&self) -> bool {
        self.state == ConnectionState::Established
    }

    pub fn is_closed(&self) -> bool {
        matches!(self.state, ConnectionState::Closed | ConnectionState::TimeWait)
    }

    pub fn should_retry(&self) -> bool {
        self.retry_count < self.max_retries
    }

    pub fn increment_retry(&mut self) {
        self.retry_count += 1;
        self.rto_calc.backoff();
    }

    pub fn retry_count(&self) -> u32 {
        self.retry_count
    }

    pub fn handshake_timed_out(&self) -> bool {
        matches!(
            self.state,
            ConnectionState::SynSent | ConnectionState::SynRecv
        ) && self.last_activity.elapsed() > self.handshake_timeout
    }

    pub fn rto_calculator(&self) -> &RtoCalculator {
        &self.rto_calc
    }

    pub fn rto_calculator_mut(&mut self) -> &mut RtoCalculator {
        &mut self.rto_calc
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{IpAddr, Ipv4Addr, SocketAddr};

    fn create_test_config() -> ProtocolConfig {
        ProtocolConfig {
            mss: 1400,
            initial_window: 10,
            max_window: 1000,
            initial_rto_ms: 1000,
            min_rto_ms: 200,
            max_rto_ms: 60000,
            handshake_timeout_ms: 3000,
            max_retries: 10,
        }
    }

    #[test]
    fn test_three_way_handshake() {
        let config = create_test_config();
        let client_addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), 8080);
        let server_addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), 8081);

        let mut client = Connection::new_client(client_addr, &config);
        let mut server = Connection::new_server(server_addr, &config);

        let syn = client.connect(server_addr);
        assert_eq!(client.state, ConnectionState::SynSent);

        let synack = server.handle_syn(&syn, client_addr).unwrap();
        assert_eq!(server.state, ConnectionState::SynRecv);

        let ack = client.handle_synack(&synack).unwrap();
        assert!(client.is_established());

        server.handle_ack(&ack);
        assert!(server.is_established());
    }
}
