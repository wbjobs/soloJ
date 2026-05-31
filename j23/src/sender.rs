use std::fs::File;
use std::io::Read;
use std::net::{SocketAddr, UdpSocket};
use std::path::Path;
use std::time::Instant;

use crate::config::Config;
use crate::connection::Connection;
use crate::cubic::Cubic;
use crate::network::NetworkSimulator;
use crate::packet::{Packet, PacketType, SeqNum};
use crate::rto::RetransmissionTimer;
use crate::stats::TransferStats;
use crate::window::SlidingWindow;

pub struct Sender {
    socket: UdpSocket,
    connection: Connection,
    window: SlidingWindow,
    cubic: Cubic,
    retrans_timer: RetransmissionTimer,
    simulator: NetworkSimulator,
    stats: TransferStats,
    config: Config,
    last_ack_num: SeqNum,
    duplicate_ack_count: u32,
    fast_recovery: bool,
}

impl Sender {
    pub fn new(
        local_addr: SocketAddr,
        remote_addr: SocketAddr,
        config: Config,
    ) -> anyhow::Result<Self> {
        let socket = UdpSocket::bind(local_addr)?;
        socket.set_nonblocking(true)?;

        let mut connection = Connection::new_client(local_addr, &config.protocol);
        let rto_calc = connection.rto_calculator_mut().clone();

        Ok(Sender {
            socket,
            connection,
            window: SlidingWindow::new(
                config.protocol.initial_window,
                config.protocol.max_window,
            ),
            cubic: Cubic::new(
                config.protocol.initial_window,
                config.protocol.max_window,
            ),
            retrans_timer: RetransmissionTimer::new(rto_calc),
            simulator: NetworkSimulator::new(config.network.clone()),
            stats: TransferStats::new(),
            config,
            last_ack_num: 0,
            duplicate_ack_count: 0,
            fast_recovery: false,
        })
    }

    pub fn connect(&mut self, remote_addr: SocketAddr) -> anyhow::Result<()> {
        println!("Connecting to {}...", remote_addr);
        
        let syn = self.connection.connect(remote_addr);
        self.send_packet(&syn)?;

        let mut buf = [0u8; 65536];
        let handshake_start = Instant::now();

        loop {
            if self.connection.handshake_timed_out() {
                if self.connection.should_retry() {
                    self.connection.increment_retry();
                    println!("Handshake timeout, retrying... (attempt {})", 
                        self.connection.retry_count());
                    self.send_packet(&syn)?;
                } else {
                    anyhow::bail!("Connection failed after max retries");
                }
            }

            match self.socket.recv_from(&mut buf) {
                Ok((len, _)) => {
                    if let Some(packet) = Packet::deserialize(&buf[..len]) {
                        if packet.packet_type == PacketType::SYNACK {
                            if let Some(ack) = self.connection.handle_synack(&packet) {
                                self.send_packet(&ack)?;
                                let initial_data_seq = self.connection.local_isn.wrapping_add(1);
                                self.window.set_initial_seq(initial_data_seq);
                                self.last_ack_num = self.connection.remote_isn.wrapping_add(1);
                                println!("Connection established! Initial data seq: {}", initial_data_seq);
                                return Ok(());
                            }
                        }
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(std::time::Duration::from_millis(10));
                }
                Err(e) => return Err(e.into()),
            }

            if handshake_start.elapsed() > std::time::Duration::from_secs(30) {
                anyhow::bail!("Connection timed out");
            }
        }
    }

    pub fn send_file(&mut self, file_path: &Path) -> anyhow::Result<TransferStats> {
        println!("Sending file: {}", file_path.display());
        
        let mut file = File::open(file_path)?;
        let file_size = file.metadata()?.len();
        println!("File size: {} bytes", file_size);

        let mut buffer = vec![0u8; self.config.protocol.mss];
        let mut finished_reading = false;

        loop {
            self.send_queued_packets();

            while self.window.can_send() && !finished_reading {
                let bytes_read = file.read(&mut buffer)?;
                if bytes_read == 0 {
                    finished_reading = true;
                    break;
                }

                let data = buffer[..bytes_read].to_vec();
                let assigned_seq = self.window.send(data.clone());
                self.retrans_timer.start(assigned_seq);

                let packet = Packet::new_data(
                    assigned_seq,
                    data,
                    self.window.window_size(),
                );
                self.send_packet(&packet)?;
            }

            if self.check_timeouts()? {
                self.duplicate_ack_count = 0;
                self.fast_recovery = false;
            }

            if self.receive_ack()? {
                if finished_reading && self.window.outstanding() == 0 {
                    break;
                }
            }

            self.flush_simulator();
        }

        self.stats.finish();
        println!("File transfer complete!");
        Ok(self.stats.clone())
    }

    fn send_packet(&mut self, packet: &Packet) -> anyhow::Result<()> {
        let bytes = packet.serialize();
        
        if self.simulator.should_drop() {
            self.stats.record_loss_event();
            return Ok(());
        }

        self.simulator.enqueue_packet(
            bytes.clone(),
            self.connection.remote_addr.unwrap(),
        );
        self.stats.record_sent(bytes.len());
        Ok(())
    }

    fn send_queued_packets(&mut self) {
        while let Some((data, dest)) = self.simulator.dequeue_ready() {
            if let Err(e) = self.socket.send_to(&data, dest) {
                eprintln!("Failed to send packet: {}", e);
            }
        }
    }

    fn flush_simulator(&mut self) {
        self.send_queued_packets();
        if !self.simulator.is_empty() {
            if let Some(due_time) = self.simulator.next_due_time() {
                let now = Instant::now();
                if due_time > now {
                    std::thread::sleep(due_time - now);
                }
                self.send_queued_packets();
            }
        }
    }

    fn receive_ack(&mut self) -> anyhow::Result<bool> {
        let mut buf = [0u8; 65536];
        
        match self.socket.recv_from(&mut buf) {
            Ok((len, _)) => {
                if let Some(packet) = Packet::deserialize(&buf[..len]) {
                    self.stats.record_received(len);

                    if packet.packet_type == PacketType::ACK {
                        if packet.ack_num == self.last_ack_num {
                            self.duplicate_ack_count += 1;
                            self.stats.record_duplicate_ack();

                            if self.duplicate_ack_count >= 3 && !self.fast_recovery {
                                self.handle_fast_retransmit();
                                return Ok(true);
                            }
                        } else {
                            let ack_advance = (packet.ack_num as i64 - self.last_ack_num as i64) as i64;
                            if ack_advance > 0 {
                                let acked = self.window.ack(packet.ack_num);
                                
                                for seq in &acked {
                                    if let Some(rtt) = self.retrans_timer.stop(*seq) {
                                        self.stats.record_rtt(rtt);
                                        self.cubic.on_ack();
                                    }
                                }

                                if self.fast_recovery {
                                    self.fast_recovery = false;
                                    self.duplicate_ack_count = 0;
                                }

                                self.window.set_receiver_window(packet.window_size);
                                self.window.set_window_size(self.cubic.cwnd());
                                self.last_ack_num = packet.ack_num;
                                self.duplicate_ack_count = 0;
                            }
                        }
                        return Ok(true);
                    }
                }
                Ok(false)
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(std::time::Duration::from_millis(1));
                Ok(false)
            }
            Err(e) => Err(e.into()),
        }
    }

    fn check_timeouts(&mut self) -> anyhow::Result<bool> {
        let inflight = self.window.inflight();
        let mut timeout_occurred = false;

        for seq in inflight {
            if self.retrans_timer.check_expired(seq) {
                if self.retrans_timer.get_retry_count(seq) >= self.config.protocol.max_retries {
                    anyhow::bail!("Max retries exceeded for seq {}", seq);
                }

                self.retrans_timer.handle_timeout(seq);
                self.cubic.on_timeout();
                self.window.set_window_size(self.cubic.cwnd());
                self.stats.record_loss_event();
                timeout_occurred = true;

                if let Some(data) = self.window.get_packet(seq).cloned() {
                    let packet = Packet::new_data(
                        seq,
                        data,
                        self.window.window_size(),
                    );
                    self.send_packet(&packet)?;
                    self.stats.record_retransmission();
                    println!("Timeout retransmission: seq={}, RTO={:?}", 
                        seq, self.retrans_timer.rto());
                }
            }
        }

        Ok(timeout_occurred)
    }

    fn handle_fast_retransmit(&mut self) {
        self.fast_recovery = true;
        self.cubic.on_loss();
        self.window.set_window_size(self.cubic.cwnd());
        self.stats.record_loss_event();

        let inflight = self.window.inflight();
        if let Some(&seq) = inflight.first() {
            self.retrans_timer.handle_timeout(seq);
            
            if let Some(data) = self.window.get_packet(seq).cloned() {
                let packet = Packet::new_data(
                    seq,
                    data,
                    self.window.window_size(),
                );
                if let Err(e) = self.send_packet(&packet) {
                    eprintln!("Fast retransmit failed: {}", e);
                }
                self.stats.record_retransmission();
                println!("Fast retransmission: seq={}, RTO={:?}", 
                    seq, self.retrans_timer.rto());
            }
        }
    }

    pub fn close(&mut self) -> anyhow::Result<()> {
        println!("Closing connection...");
        
        let fin = self.connection.initiate_close();
        self.send_packet(&fin)?;

        let mut buf = [0u8; 65536];
        let close_start = Instant::now();

        loop {
            self.flush_simulator();
            
            match self.socket.recv_from(&mut buf) {
                Ok((len, _)) => {
                    if let Some(packet) = Packet::deserialize(&buf[..len]) {
                        if packet.packet_type == PacketType::FINACK {
                            self.connection.handle_finack(&packet);
                            println!("Connection closed gracefully");
                            return Ok(());
                        }
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(std::time::Duration::from_millis(10));
                }
                Err(e) => return Err(e.into()),
            }

            if close_start.elapsed() > std::time::Duration::from_secs(5) {
                println!("Close timed out, forcing close");
                return Ok(());
            }
        }
    }
}
