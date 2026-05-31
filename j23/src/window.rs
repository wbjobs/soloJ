use std::collections::HashMap;

use crate::packet::SeqNum;

pub struct SlidingWindow {
    base: SeqNum,
    next: SeqNum,
    window_size: u32,
    max_window: u32,
    receiver_window: u32,
    packets: HashMap<SeqNum, Vec<u8>>,
    acked: HashMap<SeqNum, bool>,
}

impl SlidingWindow {
    pub fn new(initial_window: u32, max_window: u32) -> Self {
        SlidingWindow {
            base: 0,
            next: 0,
            window_size: initial_window,
            max_window,
            receiver_window: initial_window,
            packets: HashMap::new(),
            acked: HashMap::new(),
        }
    }

    pub fn set_initial_seq(&mut self, initial_seq: SeqNum) {
        self.base = initial_seq;
        self.next = initial_seq;
    }

    pub fn base(&self) -> SeqNum {
        self.base
    }

    pub fn next(&self) -> SeqNum {
        self.next
    }

    pub fn window_size(&self) -> u32 {
        self.window_size
    }

    pub fn set_receiver_window(&mut self, window: u32) {
        self.receiver_window = window;
    }

    pub fn set_window_size(&mut self, size: u32) {
        self.window_size = size.min(self.max_window);
    }

    pub fn available(&self) -> u32 {
        self.receiver_window.min(self.window_size)
    }

    pub fn can_send(&self) -> bool {
        self.outstanding() < self.available()
    }

    pub fn send(&mut self, data: Vec<u8>) -> SeqNum {
        let seq = self.next;
        self.packets.insert(seq, data);
        self.acked.insert(seq, false);
        self.next = self.next.wrapping_add(1);
        seq
    }

    pub fn get_packet(&self, seq: SeqNum) -> Option<&Vec<u8>> {
        self.packets.get(&seq)
    }

    pub fn ack(&mut self, ack_num: SeqNum) -> Vec<SeqNum> {
        let mut acked_seqs = Vec::new();
        let mut count = 0;
        let max_ack = (ack_num as i64 - self.base as i64) as u32;
        while count < max_ack && count < self.window_size {
            if let Some(_) = self.packets.get(&self.base) {
                self.acked.insert(self.base, true);
                acked_seqs.push(self.base);
                self.packets.remove(&self.base);
            }
            self.base = self.base.wrapping_add(1);
            count += 1;
        }
        acked_seqs
    }

    pub fn is_acked(&self, seq: SeqNum) -> bool {
        self.acked.get(&seq).copied().unwrap_or(false)
    }

    pub fn outstanding(&self) -> u32 {
        (self.next as i64 - self.base as i64) as u32
    }

    pub fn inflight(&self) -> Vec<SeqNum> {
        let count = self.outstanding();
        let mut result = Vec::new();
        for i in 0..count {
            let seq = self.base.wrapping_add(i);
            if !self.is_acked(seq) {
                result.push(seq);
            }
        }
        result
    }

    pub fn clear(&mut self) {
        self.packets.clear();
        self.acked.clear();
        self.base = 0;
        self.next = 0;
    }
}

pub struct ReceiverWindow {
    base: SeqNum,
    window_size: u32,
    received: HashMap<SeqNum, Vec<u8>>,
}

impl ReceiverWindow {
    pub fn new(window_size: u32) -> Self {
        ReceiverWindow {
            base: 0,
            window_size,
            received: HashMap::new(),
        }
    }

    pub fn set_initial_seq(&mut self, initial_seq: SeqNum) {
        self.base = initial_seq;
    }

    pub fn base(&self) -> SeqNum {
        self.base
    }

    pub fn window_size(&self) -> u32 {
        self.window_size
    }

    pub fn receive(&mut self, seq: SeqNum, data: Vec<u8>) -> bool {
        let offset = (seq as i64 - self.base as i64) as i32;
        if offset < 0 || offset >= self.window_size as i32 {
            return false;
        }
        self.received.insert(seq, data);
        true
    }

    pub fn consume_ready(&mut self) -> Vec<(SeqNum, Vec<u8>)> {
        let mut ready = Vec::new();
        while let Some(data) = self.received.remove(&self.base) {
            ready.push((self.base, data));
            self.base += 1;
        }
        ready
    }

    pub fn available(&self) -> u32 {
        self.window_size - self.received.len() as u32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sender_window() {
        let mut window = SlidingWindow::new(5, 100);

        assert!(window.can_send());
        let seq = window.send(vec![1, 2, 3]);
        assert_eq!(seq, 0);
        assert_eq!(window.outstanding(), 1);
    }

    #[test]
    fn test_window_ack() {
        let mut window = SlidingWindow::new(5, 100);
        window.send(vec![1]);
        window.send(vec![2]);
        window.send(vec![3]);

        let acked = window.ack(2);
        assert_eq!(acked.len(), 2);
        assert_eq!(window.base(), 2);
    }

    #[test]
    fn test_window_with_initial_seq() {
        let mut window = SlidingWindow::new(5, 100);
        window.set_initial_seq(100);
        
        assert!(window.can_send());
        let seq = window.send(vec![1, 2, 3]);
        assert_eq!(seq, 100);
        assert_eq!(window.outstanding(), 1);
        
        let seq2 = window.send(vec![4, 5, 6]);
        assert_eq!(seq2, 101);
        assert_eq!(window.outstanding(), 2);
        
        let acked = window.ack(101);
        assert_eq!(acked.len(), 1);
        assert_eq!(window.base(), 101);
        assert_eq!(window.outstanding(), 1);
    }

    #[test]
    fn test_receiver_window() {
        let mut window = ReceiverWindow::new(5);
        assert!(window.receive(0, vec![1]));
        assert!(window.receive(1, vec![2]));
        
        let ready = window.consume_ready();
        assert_eq!(ready.len(), 2);
        assert_eq!(window.base(), 2);
    }

    #[test]
    fn test_receiver_out_of_order() {
        let mut window = ReceiverWindow::new(5);
        assert!(window.receive(1, vec![2]));
        assert!(window.receive(0, vec![1]));
        
        let ready = window.consume_ready();
        assert_eq!(ready.len(), 2);
        assert_eq!(ready[0].0, 0);
        assert_eq!(ready[1].0, 1);
    }

    #[test]
    fn test_receiver_window_with_initial_seq() {
        let mut window = ReceiverWindow::new(5);
        window.set_initial_seq(100);
        
        assert!(window.receive(100, vec![1]));
        assert!(window.receive(101, vec![2]));
        assert!(!window.receive(99, vec![3]));
        
        let ready = window.consume_ready();
        assert_eq!(ready.len(), 2);
        assert_eq!(window.base(), 102);
    }
}
