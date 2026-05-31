use std::time::{Duration, Instant};

pub struct Cubic {
    cwnd: f64,
    w_max: f64,
    k: f64,
    c: f64,
    beta: f64,
    last_congestion_event: Option<Instant>,
    epoch_start: Option<Instant>,
    ssthresh: f64,
    min_cwnd: u32,
    max_cwnd: u32,
    state: CubicState,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CubicState {
    SlowStart,
    CongestionAvoidance,
}

impl Cubic {
    pub fn new(initial_cwnd: u32, max_cwnd: u32) -> Self {
        Cubic {
            cwnd: initial_cwnd as f64,
            w_max: max_cwnd as f64,
            k: 0.0,
            c: 0.4,
            beta: 0.7,
            last_congestion_event: None,
            epoch_start: None,
            ssthresh: max_cwnd as f64,
            min_cwnd: 2,
            max_cwnd,
            state: CubicState::SlowStart,
        }
    }

    pub fn cwnd(&self) -> u32 {
        self.cwnd as u32
    }

    pub fn ssthresh(&self) -> u32 {
        self.ssthresh as u32
    }

    pub fn on_ack(&mut self) {
        match self.state {
            CubicState::SlowStart => {
                self.cwnd += 1.0;
                if self.cwnd >= self.ssthresh {
                    self.state = CubicState::CongestionAvoidance;
                    self.epoch_start = Some(Instant::now());
                    self.k = (self.w_max * (1.0 - self.beta) / self.c).cbrt();
                }
            }
            CubicState::CongestionAvoidance => {
                if let Some(epoch_start) = self.epoch_start {
                    let t = epoch_start.elapsed().as_secs_f64();
                    let target = self.c * (t - self.k).powi(3) + self.w_max;
                    let window_increase = (target - self.cwnd) / self.cwnd;
                    self.cwnd += window_increase.max(0.01 / self.cwnd);
                }
            }
        }

        if self.cwnd > self.max_cwnd as f64 {
            self.cwnd = self.max_cwnd as f64;
        }
    }

    pub fn on_loss(&mut self) {
        self.w_max = self.cwnd;
        self.ssthresh = self.cwnd * self.beta;
        self.cwnd = (self.cwnd * self.beta).max(self.min_cwnd as f64);
        self.state = CubicState::SlowStart;
        self.last_congestion_event = Some(Instant::now());
        self.epoch_start = None;
    }

    pub fn on_timeout(&mut self) {
        self.w_max = self.cwnd;
        self.ssthresh = self.cwnd * self.beta;
        self.cwnd = self.min_cwnd as f64;
        self.state = CubicState::SlowStart;
        self.last_congestion_event = Some(Instant::now());
        self.epoch_start = None;
    }

    pub fn is_in_slow_start(&self) -> bool {
        self.state == CubicState::SlowStart
    }

    pub fn reset(&mut self) {
        self.cwnd = self.min_cwnd as f64;
        self.ssthresh = self.max_cwnd as f64;
        self.state = CubicState::SlowStart;
        self.epoch_start = None;
        self.last_congestion_event = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_state() {
        let cubic = Cubic::new(10, 1000);
        assert_eq!(cubic.cwnd(), 10);
        assert!(cubic.is_in_slow_start());
    }

    #[test]
    fn test_slow_start() {
        let mut cubic = Cubic::new(2, 1000);
        cubic.on_ack();
        assert_eq!(cubic.cwnd(), 3);
        cubic.on_ack();
        assert_eq!(cubic.cwnd(), 4);
    }

    #[test]
    fn test_loss() {
        let mut cubic = Cubic::new(100, 1000);
        cubic.on_loss();
        assert!(cubic.cwnd() < 100);
        assert!(cubic.cwnd() >= 2);
    }
}
