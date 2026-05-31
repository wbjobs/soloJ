use std::collections::HashMap;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::sync::Arc;
use std::time::Instant;

use crate::config::Config;
use crate::packet::{Packet, PacketType, SeqNum};
use crate::path_manager::PathManager;
use crate::stats::TransferStats;
use crate::ui::TerminalUI;
use crate::window::ReceiverWindow;

pub struct MultiPathReceiver {
    path_manager: Arc<PathManager>,
    window: ReceiverWindow,
    stats: TransferStats,
    config: Config,
    expected_seq: SeqNum,
    received_blocks: HashMap<SeqNum, Vec<u8>>,
    ui: TerminalUI,
    total_bytes_received: u64,
}

impl MultiPathReceiver {
    pub fn new(config: Config, ui_enabled: bool) -> anyhow::Result<Self> {
        let path_manager = Arc::new(PathManager::new(&config)?);
        let window = ReceiverWindow::new(config.protocol.initial_window);

        Ok(MultiPathReceiver {
            path_manager,
            window,
            stats: TransferStats::new(),
            config,
            expected_seq: 0,
            received_blocks: HashMap::new(),
            ui: TerminalUI::new(ui_enabled),
            total_bytes_received: 0,
        })
    }

    pub fn receive_file(&mut self, output_path: &Path) -> anyhow::Result<TransferStats> {
        println!("📥 Multi-Path File Receiver");
        println!("Paths: {}", self.path_manager.path_count());
        println!("Output: {}", output_path.display());
        
        let mut output_file = File::create(output_path)?;
        let mut last_ack_time = Instant::now();
        let mut last_ack_num: SeqNum = 0;

        loop {
            let mut buf = vec![0u8; 65536];
            
            if let Some((path_id, len, addr)) = self.path_manager.receive_from_any(&mut buf) {
                if let Some(packet) = Packet::deserialize(&buf[..len]) {
                    self.stats.record_received(len);

                    match packet.packet_type {
                        PacketType::DATA => {
                            self.handle_data_packet(&packet, path_id, &addr)?;
                            
                            if packet.seq_num >= last_ack_num {
                                last_ack_num = packet.seq_num.wrapping_add(1);
                                last_ack_time = Instant::now();
                            }
                            
                            self.total_bytes_received += packet.data.len() as u64;
                            
                            let ready = self.window.consume_ready();
                            for (_, data) in &ready {
                                output_file.write_all(data)?;
                            }
                            
                            if !ready.is_empty() {
                                self.expected_seq = self.window.base();
                            }
                            
                            self.send_ack(&addr)?;
                        }
                        PacketType::FIN => {
                            println!("Received FIN, closing connection");
                            break;
                        }
                        _ => {}
                    }
                }
            }

            if last_ack_time.elapsed().as_millis() > 50 && last_ack_num >= self.expected_seq {
                if let Some(path_id) = self.path_manager.active_paths().first() {
                    if let Some(state) = self.path_manager.get_path_state(*path_id) {
                        let ack = Packet::new_ack(self.expected_seq, self.window.available());
                        let ack_bytes = ack.serialize();
                        self.path_manager.send_on_path(*path_id, &ack_bytes)?;
                        last_ack_time = Instant::now();
                    }
                }
            }

            let progress = (self.total_bytes_received % 1000000) as f64 / 1000000.0;
            self.ui.update(&self.path_manager, progress, self.total_bytes_received);
        }

        self.stats.finish();
        self.ui.shutdown();
        output_file.flush()?;
        
        println!("✅ File received successfully!");
        Ok(self.stats.clone())
    }

    fn handle_data_packet(&mut self, packet: &Packet, path_id: usize, addr: &std::net::SocketAddr) -> anyhow::Result<()> {
        let seq = packet.seq_num;
        
        if self.window.receive(seq, packet.data.clone()) {
            if let Some(state) = self.path_manager.get_path_state(path_id) {
                state.record_received(packet.data.len());
            }
        }
        
        self.send_ack(addr)?;
        
        Ok(())
    }

    fn send_ack(&self, addr: &std::net::SocketAddr) -> anyhow::Result<()> {
        let ack = Packet::new_ack(self.expected_seq, self.window.available());
        let ack_bytes = ack.serialize();
        
        if let Some(path_id) = self.path_manager.active_paths().first() {
            self.path_manager.send_on_path(*path_id, &ack_bytes)?;
        }
        
        Ok(())
    }
}
