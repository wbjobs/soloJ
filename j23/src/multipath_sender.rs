use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::net::SocketAddr;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use crate::config::Config;
use crate::packet::{Packet, PacketType, SeqNum};
use crate::path_manager::PathManager;
use crate::stats::TransferStats;
use crate::ui::TerminalUI;
use crate::window::SlidingWindow;

pub struct MultiPathSender {
    path_manager: Arc<PathManager>,
    window: SlidingWindow,
    stats: TransferStats,
    config: Config,
    block_size: usize,
    last_ack_num: SeqNum,
    duplicate_ack_count: u32,
    packet_path_mapping: HashMap<SeqNum, usize>,
    packet_send_times: HashMap<SeqNum, Instant>,
    ui: TerminalUI,
}

impl MultiPathSender {
    pub fn new(config: Config, ui_enabled: bool) -> anyhow::Result<Self> {
        let path_manager = Arc::new(PathManager::new(&config)?);
        let window = SlidingWindow::new(
            config.protocol.initial_window,
            config.protocol.max_window,
        );

        Ok(MultiPathSender {
            path_manager,
            window,
            stats: TransferStats::new(),
            config,
            block_size: config.protocol.mss,
            last_ack_num: 0,
            duplicate_ack_count: 0,
            packet_path_mapping: HashMap::new(),
            packet_send_times: HashMap::new(),
            ui: TerminalUI::new(ui_enabled),
        })
    }

    pub fn send_file(&mut self, file_path: &Path) -> anyhow::Result<TransferStats> {
        println!("🚀 Multi-Path File Transfer");
        println!("Paths: {}", self.path_manager.path_count());
        println!("Scheduler: {}", self.path_manager.scheduler_type);
        println!("File: {}", file_path.display());
        
        let mut file = File::open(file_path)?;
        let file_size = file.metadata()?.len();
        println!("File size: {} bytes", file_size);
        
        let mut buffer = vec![0u8; self.block_size];
        let mut block_id: u64 = 0;
        let mut bytes_sent_total: u64 = 0;
        let mut finished_reading = false;

        loop {
            while self.can_send_more() && !finished_reading {
                let bytes_read = file.read(&mut buffer)?;
                if bytes_read == 0 {
                    finished_reading = true;
                    break;
                }

                let data = buffer[..bytes_read].to_vec();
                
                if let Some(path_id) = self.path_manager.select_path(block_id) {
                    let seq_num = self.window.send(data.clone());
                    self.packet_path_mapping.insert(seq_num, path_id);
                    self.packet_send_times.insert(seq_num, Instant::now());
                    
                    let packet = Packet::new_data(seq_num, data, self.window.window_size());
                    let packet_bytes = packet.serialize();
                    
                    self.path_manager.send_on_path(path_id, &packet_bytes)?;
                    self.stats.record_sent(packet_bytes.len());
                    
                    bytes_sent_total += bytes_read as u64;
                    block_id += 1;
                }
            }

            self.process_acks();
            
            self.check_timeouts()?;

            let progress = if file_size > 0 {
                bytes_sent_total as f64 / file_size as f64
            } else {
                1.0
            };
            
            self.ui.update(&self.path_manager, progress, bytes_sent_total);

            if finished_reading && self.window.outstanding() == 0 {
                break;
            }
        }

        self.stats.finish();
        self.ui.shutdown();
        
        println!("✅ File transfer complete!");
        Ok(self.stats.clone())
    }

    fn can_send_more(&self) -> bool {
        self.window.can_send() && self.path_manager.active_paths().len() > 0
    }

    fn process_acks(&mut self) {
        let mut buf = vec![0u8; 65536];
        
        if let Some((path_id, len, _)) = self.path_manager.receive_from_any(&mut buf) {
            if let Some(packet) = Packet::deserialize(&buf[..len]) {
                self.stats.record_received(len);

                if packet.packet_type == PacketType::ACK {
                    if packet.ack_num == self.last_ack_num {
                        self.duplicate_ack_count += 1;
                        
                        if self.duplicate_ack_count >= 3 {
                            self.handle_fast_retransmit();
                        }
                    } else {
                        let ack_advance = (packet.ack_num as i64 - self.last_ack_num as i64) as i64;
                        if ack_advance > 0 {
                            let acked = self.window.ack(packet.ack_num);
                            
                            for seq in &acked {
                                if let Some(send_time) = self.packet_send_times.remove(seq) {
                                    let rtt = send_time.elapsed();
                                    self.stats.record_rtt(rtt);
                                    
                                    if let Some(path_id) = self.packet_path_mapping.remove(seq) {
                                        self.path_manager.update_path_rtt(path_id, rtt);
                                    }
                                }
                            }
                            
                            self.window.set_receiver_window(packet.window_size);
                            self.last_ack_num = packet.ack_num;
                            self.duplicate_ack_count = 0;
                        }
                    }
                }
            }
        }
    }

    fn check_timeouts(&mut self) -> anyhow::Result<()> {
        let now = Instant::now();
        let rto = std::time::Duration::from_millis(self.config.protocol.initial_rto_ms);
        
        let inflight: Vec<SeqNum> = (self.window.base()..self.window.next())
            .filter(|seq| !self.window.is_acked(*seq))
            .collect();

        for seq in inflight {
            if let Some(send_time) = self.packet_send_times.get(&seq) {
                if now.duration_since(*send_time) >= rto {
                    if let Some(path_id) = self.packet_path_mapping.get(&seq).copied() {
                        if let Some(data) = self.window.get_packet(seq).cloned() {
                            let packet = Packet::new_data(
                                seq,
                                data,
                                self.window.window_size(),
                            );
                            let packet_bytes = packet.serialize();
                            
                            self.path_manager.send_on_path(path_id, &packet_bytes)?;
                            self.stats.record_retransmission();
                            self.packet_send_times.insert(seq, Instant::now());
                            
                            if let Some(mut state) = self.path_manager.get_path_state(path_id) {
                                state.record_retransmission();
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }

    fn handle_fast_retransmit(&mut self) {
        let inflight = self.window.inflight();
        if let Some(&seq) = inflight.first() {
            if let Some(path_id) = self.packet_path_mapping.get(&seq).copied() {
                if let Some(data) = self.window.get_packet(seq).cloned() {
                    let packet = Packet::new_data(
                        seq,
                        data,
                        self.window.window_size(),
                    );
                    if let Ok(packet_bytes) = packet.serialize() {
                        if let Err(e) = self.path_manager.send_on_path(path_id, &packet_bytes) {
                            eprintln!("Fast retransmit failed: {}", e);
                        }
                        self.stats.record_retransmission();
                        self.packet_send_times.insert(seq, Instant::now());
                    }
                }
            }
        }
        self.duplicate_ack_count = 0;
    }
}
