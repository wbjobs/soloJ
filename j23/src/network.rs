use rand::Rng;
use std::collections::VecDeque;
use std::net::SocketAddr;
use std::time::{Duration, Instant};

use crate::config::NetworkConfig;

pub struct NetworkSimulator {
    config: NetworkConfig,
    delay_queue: VecDeque<DelayedPacket>,
    rng: rand::rngs::ThreadRng,
}

struct DelayedPacket {
    data: Vec<u8>,
    dest: SocketAddr,
    send_time: Instant,
}

impl NetworkSimulator {
    pub fn new(config: NetworkConfig) -> Self {
        NetworkSimulator {
            config,
            delay_queue: VecDeque::new(),
            rng: rand::thread_rng(),
        }
    }

    pub fn should_drop(&mut self) -> bool {
        if self.config.loss_rate <= 0.0 {
            return false;
        }
        self.rng.gen::<f64>() < self.config.loss_rate
    }

    pub fn get_delay(&mut self) -> Duration {
        let base = self.config.base_delay_ms;
        let jitter = self.config.jitter_ms;
        
        if jitter == 0 {
            return Duration::from_millis(base);
        }
        
        let jitter_amount = self.rng.gen_range(0..=jitter * 2) as i64 - jitter as i64;
        let total_delay = (base as i64 + jitter_amount).max(0) as u64;
        Duration::from_millis(total_delay)
    }

    pub fn enqueue_packet(&mut self, data: Vec<u8>, dest: SocketAddr) {
        let delay = self.get_delay();
        let send_time = Instant::now() + delay;
        self.delay_queue.push_back(DelayedPacket {
            data,
            dest,
            send_time,
        });
    }

    pub fn dequeue_ready(&mut self) -> Option<(Vec<u8>, SocketAddr)> {
        let now = Instant::now();
        while let Some(packet) = self.delay_queue.front() {
            if packet.send_time <= now {
                let packet = self.delay_queue.pop_front().unwrap();
                return Some((packet.data, packet.dest));
            } else {
                break;
            }
        }
        None
    }

    pub fn next_due_time(&self) -> Option<Instant> {
        self.delay_queue.front().map(|p| p.send_time)
    }

    pub fn is_empty(&self) -> bool {
        self.delay_queue.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_no_loss() {
        let config = NetworkConfig {
            loss_rate: 0.0,
            base_delay_ms: 0,
            jitter_ms: 0,
        };
        let mut sim = NetworkSimulator::new(config);
        for _ in 0..100 {
            assert!(!sim.should_drop());
        }
    }

    #[test]
    fn test_full_loss() {
        let config = NetworkConfig {
            loss_rate: 1.0,
            base_delay_ms: 0,
            jitter_ms: 0,
        };
        let mut sim = NetworkSimulator::new(config);
        for _ in 0..100 {
            assert!(sim.should_drop());
        }
    }

    #[test]
    fn test_delay() {
        let config = NetworkConfig {
            loss_rate: 0.0,
            base_delay_ms: 100,
            jitter_ms: 0,
        };
        let mut sim = NetworkSimulator::new(config);
        let delay = sim.get_delay();
        assert_eq!(delay, Duration::from_millis(100));
    }
}
