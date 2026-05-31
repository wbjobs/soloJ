use std::collections::HashMap;
use std::time::{Duration, Instant};

use crate::packet::SeqNum;

#[derive(Clone)]
pub struct RtoCalculator {
    srtt: f64,
    rtt_var: f64,
    rto: Duration,
    min_rto: Duration,
    max_rto: Duration,
    alpha: f64,
    beta: f64,
    k: f64,
    g: f64,
}

impl RtoCalculator {
    pub fn new(initial_rto: Duration, min_rto: Duration, max_rto: Duration) -> Self {
        RtoCalculator {
            srtt: 0.0,
            rtt_var: 0.0,
            rto: initial_rto,
            min_rto,
            max_rto,
            alpha: 0.125,
            beta: 0.25,
            k: 4.0,
            g: 0.1,
        }
    }

    pub fn update(&mut self, rtt: Duration) {
        let rtt_ms = rtt.as_secs_f64() * 1000.0;

        if self.srtt == 0.0 {
            self.srtt = rtt_ms;
            self.rtt_var = rtt_ms / 2.0;
        } else {
            let delta = (rtt_ms - self.srtt).abs();
            self.rtt_var = (1.0 - self.beta) * self.rtt_var + self.beta * delta;
            self.srtt = (1.0 - self.alpha) * self.srtt + self.alpha * rtt_ms;
        }

        let rto_ms = self.srtt + (self.k * self.rtt_var).max(self.g);
        self.rto = Duration::from_millis(rto_ms.max(1.0) as u64);
        self.clamp_rto();
    }

    pub fn backoff(&mut self) {
        let rto_ms = self.rto.as_secs_f64() * 1000.0;
        self.rto = Duration::from_millis((rto_ms * 2.0) as u64);
        self.clamp_rto();
    }

    fn clamp_rto(&mut self) {
        if self.rto < self.min_rto {
            self.rto = self.min_rto;
        } else if self.rto > self.max_rto {
            self.rto = self.max_rto;
        }
    }

    pub fn rto(&self) -> Duration {
        self.rto
    }

    pub fn srtt(&self) -> Duration {
        Duration::from_millis(self.srtt.max(0.0) as u64)
    }

    pub fn rtt_var(&self) -> Duration {
        Duration::from_millis(self.rtt_var.max(0.0) as u64)
    }
}

pub struct RetransmissionTimer {
    timers: HashMap<SeqNum, (Instant, u32, bool)>,
    rto_calc: RtoCalculator,
}

impl RetransmissionTimer {
    pub fn new(rto_calc: RtoCalculator) -> Self {
        RetransmissionTimer {
            timers: HashMap::new(),
            rto_calc,
        }
    }

    pub fn start(&mut self, seq_num: SeqNum) {
        self.timers.insert(seq_num, (Instant::now(), 0, false));
    }

    pub fn stop(&mut self, seq_num: SeqNum) -> Option<Duration> {
        if let Some((start_time, retries, retransmitted)) = self.timers.remove(&seq_num) {
            let rtt = start_time.elapsed();
            if !retransmitted {
                self.rto_calc.update(rtt);
            }
            Some(rtt)
        } else {
            None
        }
    }

    pub fn check_expired(&mut self, seq_num: SeqNum) -> bool {
        if let Some((start_time, _, _)) = self.timers.get(&seq_num) {
            let elapsed = start_time.elapsed();
            let current_rto = self.rto_calc.rto();
            elapsed >= current_rto
        } else {
            false
        }
    }

    pub fn handle_timeout(&mut self, seq_num: SeqNum) -> bool {
        if let Some((start_time, retries, retransmitted)) = self.timers.get_mut(&seq_num) {
            *retries += 1;
            *retransmitted = true;
            self.rto_calc.backoff();
            *start_time = Instant::now();
            true
        } else {
            false
        }
    }

    pub fn get_retry_count(&self, seq_num: SeqNum) -> u32 {
        self.timers.get(&seq_num).map(|(_, r, _)| *r).unwrap_or(0)
    }

    pub fn is_retransmitted(&self, seq_num: SeqNum) -> bool {
        self.timers.get(&seq_num).map(|(_, _, r)| *r).unwrap_or(false)
    }

    pub fn rto(&self) -> Duration {
        self.rto_calc.rto()
    }

    pub fn srtt(&self) -> Duration {
        self.rto_calc.srtt()
    }

    pub fn clear(&mut self) {
        self.timers.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rto_initial() {
        let initial = Duration::from_millis(1000);
        let min = Duration::from_millis(200);
        let max = Duration::from_millis(60000);
        let rto = RtoCalculator::new(initial, min, max);
        assert_eq!(rto.rto(), initial);
    }

    #[test]
    fn test_rto_update() {
        let initial = Duration::from_millis(1000);
        let min = Duration::from_millis(200);
        let max = Duration::from_millis(60000);
        let mut rto = RtoCalculator::new(initial, min, max);

        rto.update(Duration::from_millis(200));
        assert!(rto.rto() > Duration::from_millis(0));
        assert!(rto.rto() < Duration::from_millis(2000));
    }

    #[test]
    fn test_rto_backoff() {
        let initial = Duration::from_millis(1000);
        let min = Duration::from_millis(200);
        let max = Duration::from_millis(60000);
        let mut rto = RtoCalculator::new(initial, min, max);

        let original = rto.rto();
        rto.backoff();
        assert_eq!(rto.rto(), original * 2);
    }

    #[test]
    fn test_retransmission_timer() {
        let initial = Duration::from_millis(1000);
        let min = Duration::from_millis(200);
        let max = Duration::from_millis(60000);
        let rto_calc = RtoCalculator::new(initial, min, max);
        let mut timer = RetransmissionTimer::new(rto_calc);

        timer.start(100);
        assert!(!timer.check_expired(100));
        assert!(!timer.is_retransmitted(100));

        timer.handle_timeout(100);
        assert_eq!(timer.get_retry_count(100), 1);
        assert!(timer.is_retransmitted(100));
    }
}
