use std::fs::File;
use std::io::Write;
use std::net::{SocketAddr, UdpSocket};
use std::path::Path;
use std::time::Instant;

use crate::config::Config;
use crate::connection::Connection;
use crate::network::NetworkSimulator;
use crate::packet::{Packet, PacketType, SeqNum};
use crate::stats::TransferStats;
use crate::window::ReceiverWindow;

pub struct Receiver {
    socket: UdpSocket,
    connection: Connection,
    window: ReceiverWindow,
    simulator: NetworkSimulator,
    stats: TransferStats,
    config: Config,
    expected_seq: SeqNum,
    output_file: Option<File>,
}

impl Receiver {
    pub fn new(
        bind_addr: SocketAddr,
        config: Config,
    ) -> anyhow::Result<Self> {
        let socket = UdpSocket::bind(bind_addr)?;
        socket.set_nonblocking(true)?;

        Ok(Receiver {
            socket,
            connection: Connection::new_server(bind_addr, &config.protocol),
            window: ReceiverWindow::new(config.protocol.initial_window),
            simulator: NetworkSimulator::new(config.network.clone()),
            stats: TransferStats::new(),
            config,
            expected_seq: 0,
            output_file: None,
        })
    }

    pub fn accept(&mut self) -> anyhow::Result<()> {
        println!("Waiting for connection on {}...", self.socket.local_addr()?);
        
        let mut buf = [0u8; 65536];
        let accept_start = Instant::now();

        loop {
            match self.socket.recv_from(&mut buf) {
                Ok((len, addr)) => {
                    if let Some(packet) = Packet::deserialize(&buf[..len]) {
                        if packet.packet_type == PacketType::SYN {
                            println!("Received SYN from {}", addr);
                            
                            if let Some(synack) = self.connection.handle_syn(&packet, addr) {
                                self.send_packet(&synack, addr)?;
                                
                                loop {
                                    match self.socket.recv_from(&mut buf) {
                                        Ok((len2, _)) => {
                                            if let Some(ack) = Packet::deserialize(&buf[..len2]) {
                                                if ack.packet_type == PacketType::ACK 
                                                && ack.ack_num == self.connection.local_isn.wrapping_add(1) 
                                            {
                                                self.connection.handle_ack(&ack);
                                                self.expected_seq = self.connection.remote_isn.wrapping_add(1);
                                                self.window.set_initial_seq(self.expected_seq);
                                                println!("Connection established with {}", addr);
                                                return Ok(());
                                            }
                                            }
                                        }
                                        Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                                            std::thread::sleep(std::time::Duration::from_millis(10));
                                        }
                                        Err(e) => return Err(e.into()),
                                    }

                                    if accept_start.elapsed() > std::time::Duration::from_secs(30) {
                                        anyhow::bail!("Connection timed out waiting for ACK");
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
                Err(e) => return Err(e.into()),
            }

            if accept_start.elapsed() > std::time::Duration::from_secs(60) {
                anyhow::bail!("Accept timed out");
            }
        }
    }

    pub fn receive_file(&mut self, output_path: &Path) -> anyhow::Result<TransferStats> {
        println!("Receiving file to: {}", output_path.display());
        
        self.output_file = Some(File::create(output_path)?);
        let mut last_ack_time = Instant::now();
        let mut last_ack_num: SeqNum = 0;

        loop {
            self.send_queued_packets();

            let mut buf = [0u8; 65536];
            match self.socket.recv_from(&mut buf) {
                Ok((len, addr)) => {
                    if let Some(packet) = Packet::deserialize(&buf[..len]) {
                        self.stats.record_received(len);

                        match packet.packet_type {
                            PacketType::DATA => {
                                self.handle_data_packet(&packet, addr)?;
                                
                                if packet.seq_num >= last_ack_num {
                                    last_ack_num = packet.seq_num.wrapping_add(1);
                                    last_ack_time = Instant::now();
                                }
                            }
                            PacketType::FIN => {
                                println!("Received FIN, closing connection");
                                let finack = self.connection.handle_fin(&packet);
                                self.send_packet(&finack, addr)?;
                                self.flush_simulator();
                                
                                std::thread::sleep(std::time::Duration::from_millis(500));
                                break;
                            }
                            PacketType::SYN => {
                                if let Some(synack) = self.connection.handle_syn(&packet, addr) {
                                    self.send_packet(&synack, addr)?;
                                }
                            }
                            _ => {}
                        }
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(std::time::Duration::from_millis(1));
                }
                Err(e) => return Err(e.into()),
            }

            if last_ack_time.elapsed() > std::time::Duration::from_millis(50) 
                && last_ack_num >= self.expected_seq 
            {
                if let Some(addr) = self.connection.remote_addr {
                    self.send_ack(addr)?;
                    last_ack_time = Instant::now();
                }
            }

            self.flush_simulator();
        }

        self.stats.finish();
        if let Some(file) = self.output_file.as_mut() {
            file.flush()?;
        }
        println!("File received successfully!");
        Ok(self.stats.clone())
    }

    fn handle_data_packet(&mut self, packet: &Packet, addr: SocketAddr) -> anyhow::Result<()> {
        let seq = packet.seq_num;

        if self.window.receive(seq, packet.data.clone()) {
            let ready = self.window.consume_ready();
            
            if let Some(file) = self.output_file.as_mut() {
                for (_, data) in &ready {
                    file.write_all(data)?;
                }
            }

            if !ready.is_empty() {
                self.expected_seq = self.window.base();
            }

            self.send_ack(addr)?;
        } else {
            self.send_ack(addr)?;
        }

        Ok(())
    }

    fn send_ack(&mut self, addr: SocketAddr) -> anyhow::Result<()> {
        let ack = Packet::new_ack(self.expected_seq, self.window.available());
        self.send_packet(&ack, addr)
    }

    fn send_packet(&mut self, packet: &Packet, addr: SocketAddr) -> anyhow::Result<()> {
        let bytes = packet.serialize();
        
        if self.simulator.should_drop() {
            return Ok(());
        }

        self.simulator.enqueue_packet(bytes.clone(), addr);
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
}
