use std::time::Duration;

#[derive(Debug, Clone)]
pub struct TransferStats {
    pub total_bytes_sent: u64,
    pub total_bytes_received: u64,
    pub total_packets_sent: u64,
    pub total_packets_received: u64,
    pub retransmitted_packets: u64,
    pub duplicate_acks: u64,
    pub rtt_samples: Vec<Duration>,
    pub start_time: std::time::Instant,
    pub end_time: Option<std::time::Instant>,
    pub packet_loss_events: u64,
}

impl TransferStats {
    pub fn new() -> Self {
        TransferStats {
            total_bytes_sent: 0,
            total_bytes_received: 0,
            total_packets_sent: 0,
            total_packets_received: 0,
            retransmitted_packets: 0,
            duplicate_acks: 0,
            rtt_samples: Vec::new(),
            start_time: std::time::Instant::now(),
            end_time: None,
            packet_loss_events: 0,
        }
    }

    pub fn record_sent(&mut self, bytes: usize) {
        self.total_bytes_sent += bytes as u64;
        self.total_packets_sent += 1;
    }

    pub fn record_received(&mut self, bytes: usize) {
        self.total_bytes_received += bytes as u64;
        self.total_packets_received += 1;
    }

    pub fn record_retransmission(&mut self) {
        self.retransmitted_packets += 1;
    }

    pub fn record_rtt(&mut self, rtt: Duration) {
        self.rtt_samples.push(rtt);
    }

    pub fn record_duplicate_ack(&mut self) {
        self.duplicate_acks += 1;
    }

    pub fn record_loss_event(&mut self) {
        self.packet_loss_events += 1;
    }

    pub fn finish(&mut self) {
        self.end_time = Some(std::time::Instant::now());
    }

    pub fn elapsed(&self) -> Duration {
        match self.end_time {
            Some(end) => end.duration_since(self.start_time),
            None => self.start_time.elapsed(),
        }
    }

    pub fn average_rtt(&self) -> Option<Duration> {
        if self.rtt_samples.is_empty() {
            return None;
        }
        let total: Duration = self.rtt_samples.iter().sum();
        Some(total / self.rtt_samples.len() as u32)
    }

    pub fn min_rtt(&self) -> Option<Duration> {
        self.rtt_samples.iter().copied().min()
    }

    pub fn max_rtt(&self) -> Option<Duration> {
        self.rtt_samples.iter().copied().max()
    }

    pub fn throughput(&self) -> f64 {
        let elapsed = self.elapsed().as_secs_f64();
        if elapsed <= 0.0 {
            return 0.0;
        }
        (self.total_bytes_sent as f64) / elapsed
    }

    pub fn throughput_mbps(&self) -> f64 {
        self.throughput() * 8.0 / 1_000_000.0
    }

    pub fn retransmission_rate(&self) -> f64 {
        if self.total_packets_sent == 0 {
            return 0.0;
        }
        self.retransmitted_packets as f64 / self.total_packets_sent as f64
    }

    pub fn goodput(&self) -> f64 {
        let elapsed = self.elapsed().as_secs_f64();
        if elapsed <= 0.0 {
            return 0.0;
        }
        let good_bytes = self.total_bytes_received as f64;
        good_bytes / elapsed
    }

    pub fn goodput_mbps(&self) -> f64 {
        self.goodput() * 8.0 / 1_000_000.0
    }

    pub fn print_summary(&self) {
        println!("\n=== Transfer Statistics ===");
        println!("Duration: {:.2} seconds", self.elapsed().as_secs_f64());
        println!("Total bytes sent: {}", self.total_bytes_sent);
        println!("Total bytes received: {}", self.total_bytes_received);
        println!("Total packets sent: {}", self.total_packets_sent);
        println!("Total packets received: {}", self.total_packets_received);
        println!("Retransmitted packets: {}", self.retransmitted_packets);
        println!("Retransmission rate: {:.2}%", self.retransmission_rate() * 100.0);
        println!("Duplicate ACKs: {}", self.duplicate_acks);
        println!("Packet loss events: {}", self.packet_loss_events);

        if let Some(avg_rtt) = self.average_rtt() {
            println!("Average RTT: {:.2} ms", avg_rtt.as_secs_f64() * 1000.0);
        }
        if let Some(min_rtt) = self.min_rtt() {
            println!("Min RTT: {:.2} ms", min_rtt.as_secs_f64() * 1000.0);
        }
        if let Some(max_rtt) = self.max_rtt() {
            println!("Max RTT: {:.2} ms", max_rtt.as_secs_f64() * 1000.0);
        }

        println!("Throughput: {:.2} Mbps", self.throughput_mbps());
        println!("Goodput: {:.2} Mbps", self.goodput_mbps());
        println!("=========================\n");
    }
}

impl Default for TransferStats {
    fn default() -> Self {
        Self::new()
    }
}
