use std::collections::HashMap;
use std::net::{SocketAddr, UdpSocket};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use crate::config::{Config, PathConfig};
use crate::network::NetworkSimulator;
use crate::stats::TransferStats;

#[derive(Debug, Clone)]
pub struct PathState {
    pub name: String,
    pub bind_addr: SocketAddr,
    pub remote_addr: SocketAddr,
    pub rtt: Duration,
    pub smoothed_rtt: Duration,
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub packets_sent: u64,
    pub packets_received: u64,
    pub retransmissions: u64,
    pub loss_rate: f64,
    pub effective_bandwidth: f64,
    pub is_active: bool,
    pub last_activity: Instant,
    pub rtt_samples: Vec<Duration>,
}

impl PathState {
    pub fn new(name: &str, bind_addr: SocketAddr, remote_addr: SocketAddr) -> Self {
        PathState {
            name: name.to_string(),
            bind_addr,
            remote_addr,
            rtt: Duration::from_millis(100),
            smoothed_rtt: Duration::from_millis(100),
            bytes_sent: 0,
            bytes_received: 0,
            packets_sent: 0,
            packets_received: 0,
            retransmissions: 0,
            loss_rate: 0.0,
            effective_bandwidth: 0.0,
            is_active: true,
            last_activity: Instant::now(),
            rtt_samples: Vec::new(),
        }
    }

    pub fn update_rtt(&mut self, rtt: Duration) {
        self.rtt = rtt;
        self.rtt_samples.push(rtt);
        if self.rtt_samples.len() > 50 {
            self.rtt_samples.remove(0);
        }
        
        if self.smoothed_rtt.as_secs_f64() == 0.0 {
            self.smoothed_rtt = rtt;
        } else {
            let alpha = 0.125;
            let smoothed = self.smoothed_rtt.as_secs_f64();
            let new_rtt = rtt.as_secs_f64();
            self.smoothed_rtt = Duration::from_secs_f64(
                smoothed * (1.0 - alpha) + new_rtt * alpha
            );
        }
        self.last_activity = Instant::now();
    }

    pub fn record_sent(&mut self, bytes: usize) {
        self.bytes_sent += bytes as u64;
        self.packets_sent += 1;
    }

    pub fn record_received(&mut self, bytes: usize) {
        self.bytes_received += bytes as u64;
        self.packets_received += 1;
        self.last_activity = Instant::now();
    }

    pub fn record_retransmission(&mut self) {
        self.retransmissions += 1;
    }
}

pub struct PathManager {
    pub paths: HashMap<usize, PathEntry>,
    pub scheduler_type: String,
    pub global_stats: TransferStats,
}

pub struct PathEntry {
    pub state: Mutex<PathState>,
    pub socket: UdpSocket,
    pub simulator: Mutex<NetworkSimulator>,
    pub config: PathConfig,
}

impl PathManager {
    pub fn new(config: &Config) -> anyhow::Result<Self> {
        let mut paths = HashMap::new();
        
        for (i, path_config) in config.multipath.paths.iter().enumerate() {
            let bind_addr: SocketAddr = path_config.bind_addr.parse()?;
            let remote_addr: SocketAddr = path_config.remote_addr.parse()?;
            
            let socket = UdpSocket::bind(bind_addr)?;
            socket.set_nonblocking(true)?;
            
            let loss_rate = path_config.loss_rate.unwrap_or(config.network.loss_rate);
            let base_delay = path_config.base_delay_ms.unwrap_or(config.network.base_delay_ms);
            let jitter = path_config.jitter_ms.unwrap_or(config.network.jitter_ms);
            
            let network_config = crate::config::NetworkConfig {
                loss_rate,
                base_delay_ms: base_delay,
                jitter_ms: jitter,
            };
            
            let simulator = Mutex::new(NetworkSimulator::new(network_config));
            let state = Mutex::new(PathState::new(&path_config.name, bind_addr, remote_addr));
            
            paths.insert(i, PathEntry {
                state,
                socket,
                simulator,
                config: path_config.clone(),
            });
        }
        
        Ok(PathManager {
            paths,
            scheduler_type: config.multipath.scheduler.clone(),
            global_stats: TransferStats::new(),
        })
    }
    
    pub fn select_path(&self, block_id: u64) -> Option<usize> {
        match self.scheduler_type.as_str() {
            "round_robin" => self.round_robin(block_id),
            "rtt_weighted" => self.rtt_weighted(),
            "bandwidth_weighted" => self.bandwidth_weighted(),
            _ => self.rtt_weighted(),
        }
    }
    
    fn round_robin(&self, block_id: u64) -> Option<usize> {
        let active_paths: Vec<usize> = self.paths.iter()
            .filter(|(_, entry)| entry.state.lock().ok()?.is_active)
            .map(|(id, _)| *id)
            .collect();
        
        if active_paths.is_empty() {
            return None;
        }
        
        Some(active_paths[(block_id as usize) % active_paths.len()])
    }
    
    fn rtt_weighted(&self) -> Option<usize> {
        let mut best_path = None;
        let mut best_rtt = Duration::from_secs(u64::MAX);
        
        for (id, entry) in &self.paths {
            if let Ok(state) = entry.state.lock() {
                if state.is_active && state.smoothed_rtt < best_rtt {
                    best_rtt = state.smoothed_rtt;
                    best_path = Some(*id);
                }
            }
        }
        
        best_path
    }
    
    fn bandwidth_weighted(&self) -> Option<usize> {
        let mut best_path = None;
        let mut best_bw = 0.0f64;
        
        for (id, entry) in &self.paths {
            if let Ok(state) = entry.state.lock() {
                if state.is_active && state.effective_bandwidth > best_bw {
                    best_bw = state.effective_bandwidth;
                    best_path = Some(*id);
                }
            }
        }
        
        best_path
    }
    
    pub fn send_on_path(&self, path_id: usize, data: &[u8]) -> anyhow::Result<()> {
        if let Some(entry) = self.paths.get(&path_id) {
            let remote_addr = entry.state.lock()?.remote_addr;
            
            let mut simulator = entry.simulator.lock()?;
            
            if simulator.should_drop() {
                drop(simulator);
                if let Ok(mut state) = entry.state.lock() {
                    state.record_retransmission();
                }
                return Ok(());
            }
            
            simulator.enqueue_packet(data.to_vec(), remote_addr);
            drop(simulator);
            
            if let Ok(mut state) = entry.state.lock() {
                state.record_sent(data.len());
            }
            
            self.flush_packets(path_id)?;
        }
        Ok(())
    }
    
    fn flush_packets(&self, path_id: usize) -> anyhow::Result<()> {
        if let Some(entry) = self.paths.get(&path_id) {
            let mut simulator = entry.simulator.lock()?;
            
            while let Some((data, dest)) = simulator.dequeue_ready() {
                if let Err(e) = entry.socket.send_to(&data, dest) {
                    eprintln!("Failed to send on path {}: {}", entry.config.name, e);
                }
            }
        }
        Ok(())
    }
    
    pub fn receive_from_any(&self, buf: &mut [u8]) -> Option<(usize, usize, SocketAddr)> {
        for (path_id, entry) in &self.paths {
            match entry.socket.recv_from(buf) {
                Ok((len, addr)) => {
                    if let Ok(mut state) = entry.state.lock() {
                        state.record_received(len);
                    }
                    return Some((*path_id, len, addr));
                }
                Err(_) => continue,
            }
        }
        None
    }
    
    pub fn update_path_rtt(&self, path_id: usize, rtt: Duration) {
        if let Some(entry) = self.paths.get(&path_id) {
            if let Ok(mut state) = entry.state.lock() {
                state.update_rtt(rtt);
            }
        }
    }
    
    pub fn get_path_state(&self, path_id: usize) -> Option<std::sync::MutexGuard<PathState>> {
        self.paths.get(&path_id)?.state.lock().ok()
    }
    
    pub fn active_paths(&self) -> Vec<usize> {
        self.paths.iter()
            .filter(|(_, entry)| entry.state.lock().ok().map(|s| s.is_active).unwrap_or(false))
            .map(|(id, _)| *id)
            .collect()
    }
    
    pub fn path_count(&self) -> usize {
        self.paths.len()
    }
}
