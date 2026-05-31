use std::io::{self, Write};
use std::time::Duration;

use crate::path_manager::PathManager;

pub struct TerminalUI {
    enabled: bool,
    last_update: std::time::Instant,
    terminal_size: (usize, usize),
}

impl TerminalUI {
    pub fn new(enabled: bool) -> Self {
        TerminalUI {
            enabled,
            last_update: std::time::Instant::now(),
            terminal_size: get_terminal_size(),
        }
    }

    pub fn update(&mut self, path_manager: &PathManager, file_progress: f64, total_bytes: u64) {
        if !self.enabled {
            return;
        }

        if self.last_update.elapsed() < Duration::from_millis(200) {
            return;
        }
        self.last_update = std::time::Instant::now();

        self.clear_screen();
        self.print_header();
        self.print_path_states(path_manager);
        self.print_progress(file_progress, total_bytes);
        self.print_footer();
        io::stdout().flush().ok();
    }

    fn clear_screen(&self) {
        print!("\x1B[2J\x1B[1;1H");
    }

    fn print_header(&self) {
        let width = self.terminal_size.0;
        println!("{:─<width$}", "─", width = width);
        println!("  🚀 Multi-Path UDP Reliable Transport Protocol");
        println!("{:─<width$}", "─", width = width);
        println!();
    }

    fn print_path_states(&self, path_manager: &PathManager) {
        println!("  📡 Path Status:");
        println!("  {:─<60}", "");
        
        for path_id in 0..path_manager.path_count() {
            if let Some(state) = path_manager.get_path_state(path_id) {
                let status_icon = if state.is_active { "✅" } else { "❌" };
                let rtt_ms = state.smoothed_rtt.as_secs_f64() * 1000.0;
                let throughput = if state.last_activity.elapsed().as_secs_f64() > 0.0 {
                    state.bytes_sent as f64 / state.last_activity.elapsed().as_secs_f64() * 8.0 / 1_000_000.0
                } else {
                    0.0
                };
                
                println!("  {} Path {:<10} | RTT: {:>7.1} ms | Throughput: {:>6.2} Mbps | Sent: {:>8} | Recv: {:>8}",
                    status_icon,
                    state.name,
                    rtt_ms,
                    throughput,
                    format_bytes(state.bytes_sent),
                    format_bytes(state.bytes_received)
                );
                
                let total_packets = state.packets_sent.max(1);
                let loss_pct = state.retransmissions as f64 / total_packets as f64 * 100.0;
                
                println!("    Retrans: {:>5} ({:.1}%) | Loss Rate: {:.1}%",
                    state.retransmissions,
                    loss_pct,
                    state.loss_rate * 100.0
                );
                
                self.print_rtt_bar(&state.rtt_samples);
            }
            println!("  {:─<60}", "");
        }
        println!();
    }

    fn print_rtt_bar(&self, rtt_samples: &[Duration]) {
        if rtt_samples.is_empty() {
            return;
        }
        
        let recent: Vec<&Duration> = rtt_samples.iter().rev().take(30).collect();
        if recent.is_empty() {
            return;
        }
        
        let max_rtt = recent.iter().map(|r| r.as_millis() as u64).max().unwrap_or(100).max(100);
        
        print!("    RTT History: ");
        for rtt in recent.iter().rev() {
            let normalized = (rtt.as_millis() as u64 * 20 / max_rtt).min(20) as usize;
            let bar_char = if normalized < 7 { '▁' }
                else if normalized < 10 { '▃' }
                else if normalized < 13 { '▅' }
                else if normalized < 16 { '▇' }
                else { '█' };
            print!("{}", bar_char);
        }
        println!();
    }

    fn print_progress(&self, progress: f64, total_bytes: u64) {
        let width = 50;
        let filled = (progress * width as f64) as usize;
        let empty = width - filled;
        
        println!("  📊 Transfer Progress:");
        println!("  Total: {} | Progress: {:.1}%", format_bytes(total_bytes), progress * 100.0);
        println!("  [{}{}]", "█".repeat(filled), "░".repeat(empty));
        println!();
    }

    fn print_footer(&self) {
        let width = self.terminal_size.0;
        println!("{:─<width$}", "─", width = width);
        println!("  Press Ctrl+C to stop | UI updates every 200ms");
        println!("{:─<width$}", "─", width = width);
    }

    pub fn shutdown(&self) {
        if self.enabled {
            println!();
            println!("  Transfer complete!");
        }
    }
}

fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit = 0;
    
    while size >= 1024.0 && unit < UNITS.len() - 1 {
        size /= 1024.0;
        unit += 1;
    }
    
    format!("{:.1} {}", size, UNITS[unit])
}

fn get_terminal_size() -> (usize, usize) {
    #[cfg(windows)]
    {
        if let Ok(size) = crossterm::terminal::size() {
            return (size.0 as usize, size.1 as usize);
        }
    }
    #[cfg(not(windows))]
    {
        if let Ok(size) = termion::terminal_size() {
            return (size.0 as usize, size.1 as usize);
        }
    }
    (80, 24)
}
