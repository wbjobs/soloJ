use std::fs::OpenOptions;
use std::io::Write;

use chrono::Local;
use sysinfo::{CpuExt, Pid, ProcessExt, Signal, System, SystemExt};

pub struct MetricsCollector {
    system: System,
    cpu_history: Vec<f32>,
    max_history: usize,
}

#[derive(Debug, Clone)]
pub struct ProcessInfo {
    pub pid: Pid,
    pub name: String,
    pub cpu: f32,
    pub memory: u64,
    pub status: String,
}

#[derive(Debug, Clone)]
pub struct SystemMetrics {
    pub cpu_usage: f32,
    pub cpu_history: Vec<f32>,
    pub memory_total: u64,
    pub memory_used: u64,
    pub memory_percent: f32,
    pub swap_total: u64,
    pub swap_used: u64,
    pub swap_percent: f32,
    pub processes: Vec<ProcessInfo>,
    pub time: String,
    pub uptime: u64,
}

impl MetricsCollector {
    pub fn new(max_history: usize) -> Self {
        let mut system = System::new_all();
        system.refresh_all();
        Self {
            system,
            cpu_history: Vec::with_capacity(max_history),
            max_history,
        }
    }

    pub fn refresh(&mut self) {
        self.system.refresh_cpu_usage();
        self.system.refresh_memory();
        self.system.refresh_processes();
    }

    pub fn get_metrics(&mut self) -> SystemMetrics {
        self.refresh();

        let cpu_usage = self.system.global_cpu_info().cpu_usage();

        self.cpu_history.push(cpu_usage);
        if self.cpu_history.len() > self.max_history {
            self.cpu_history.remove(0);
        }

        let memory_total = self.system.total_memory();
        let memory_used = self.system.used_memory();
        let memory_percent = if memory_total > 0 {
            (memory_used as f32 / memory_total as f32) * 100.0
        } else {
            0.0
        };

        let swap_total = self.system.total_swap();
        let swap_used = self.system.used_swap();
        let swap_percent = if swap_total > 0 {
            (swap_used as f32 / swap_total as f32) * 100.0
        } else {
            0.0
        };

        let mut processes: Vec<ProcessInfo> = self
            .system
            .processes()
            .iter()
            .map(|(pid, process)| ProcessInfo {
                pid: *pid,
                name: process.name().to_string(),
                cpu: process.cpu_usage(),
                memory: process.memory(),
                status: process.status().to_string(),
            })
            .collect();

        processes.sort_by(|a, b| {
            b.cpu
                .partial_cmp(&a.cpu)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        SystemMetrics {
            cpu_usage,
            cpu_history: self.cpu_history.clone(),
            memory_total,
            memory_used,
            memory_percent,
            swap_total,
            swap_used,
            swap_percent,
            processes,
            time: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            uptime: self.system.uptime(),
        }
    }

    pub fn kill_process(&mut self, pid: Pid) -> bool {
        if let Some(process) = self.system.process(pid) {
            process.kill_with(Signal::Kill).unwrap_or(false)
        } else {
            false
        }
    }
}

pub fn log_snapshot(metrics: &SystemMetrics, path: &str) -> std::io::Result<()> {
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    let timestamp = &metrics.time;
    writeln!(file, "[{}] System Snapshot", timestamp)?;
    writeln!(
        file,
        "  CPU: {:.1}%  |  Memory: {} / {} ({:.1}%)  |  Swap: {} / {} ({:.1}%)",
        metrics.cpu_usage,
        format_bytes(metrics.memory_used),
        format_bytes(metrics.memory_total),
        metrics.memory_percent,
        format_bytes(metrics.swap_used),
        format_bytes(metrics.swap_total),
        metrics.swap_percent,
    )?;
    writeln!(file, "  Top 5 Processes by CPU:")?;
    for (i, p) in metrics.processes.iter().take(5).enumerate() {
        writeln!(
            file,
            "    {}. PID={} Name={} CPU={:.1}% Mem={}",
            i + 1,
            p.pid,
            p.name,
            p.cpu,
            format_bytes(p.memory),
        )?;
    }
    writeln!(file, "---")?;
    Ok(())
}

pub fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = 1024 * KB;
    const GB: u64 = 1024 * MB;
    const TB: u64 = 1024 * GB;

    if bytes >= TB {
        format!("{:.2} TB", bytes as f64 / TB as f64)
    } else if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

pub fn format_uptime(seconds: u64) -> String {
    let days = seconds / 86400;
    let hours = (seconds % 86400) / 3600;
    let minutes = (seconds % 3600) / 60;
    let secs = seconds % 60;

    if days > 0 {
        format!("{}d {:02}h {:02}m", days, hours, minutes)
    } else if hours > 0 {
        format!("{}h {:02}m {:02}s", hours, minutes, secs)
    } else {
        format!("{}m {:02}s", minutes, secs)
    }
}
