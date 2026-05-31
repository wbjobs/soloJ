mod metrics;
mod tui;

use std::io;
use std::time::{Duration, Instant};

use anyhow::Result;
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyEventKind},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};

use crate::metrics::{log_snapshot, MetricsCollector, SystemMetrics};

const REFRESH_INTERVAL: Duration = Duration::from_millis(1000);
const CPU_HISTORY_SIZE: usize = 60;
const LOG_FILE: &str = "monitor.log";

fn main() -> Result<()> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;
    terminal.clear()?;

    let mut collector = MetricsCollector::new(CPU_HISTORY_SIZE);
    let mut last_tick = Instant::now();
    let mut selected_index: usize = 0;
    let mut status_msg = String::new();
    let mut status_expiry = Instant::now();

    let mut metrics = collector.get_metrics();
    tui::draw(&mut terminal, &metrics, selected_index, &status_msg)?;

    loop {
        let timeout = REFRESH_INTERVAL
            .checked_sub(last_tick.elapsed())
            .unwrap_or_else(|| Duration::from_secs(0));

        let event_happened = event::poll(timeout)?;

        if event_happened {
            if let Event::Key(key) = event::read()? {
                if key.kind != KeyEventKind::Press {
                    continue;
                }
                let visible = metrics.processes.len().min(15);
                match key.code {
                    KeyCode::Char('q') => break,
                    KeyCode::Up => {
                        if visible > 0 && selected_index > 0 {
                            selected_index -= 1;
                        }
                        tui::draw(&mut terminal, &metrics, selected_index, &status_msg)?;
                    }
                    KeyCode::Down => {
                        if selected_index + 1 < visible {
                            selected_index += 1;
                        }
                        tui::draw(&mut terminal, &metrics, selected_index, &status_msg)?;
                    }
                    KeyCode::Char('k') => {
                        if selected_index < visible {
                            let pid = metrics.processes[selected_index].pid;
                            let name = metrics.processes[selected_index].name.clone();
                            let killed = collector.kill_process(pid);
                            if killed {
                                status_msg = format!("Killed PID {} ({})", pid, name);
                            } else {
                                status_msg = format!("Failed to kill PID {} ({})", pid, name);
                            }
                            status_expiry = Instant::now() + Duration::from_secs(3);
                            metrics = collector.get_metrics();
                            clamp_selected(&mut selected_index, &metrics);
                            tui::draw(&mut terminal, &metrics, selected_index, &status_msg)?;
                        }
                    }
                    KeyCode::Char('l') => {
                        match log_snapshot(&metrics, LOG_FILE) {
                            Ok(()) => {
                                status_msg = format!("Snapshot saved to {}", LOG_FILE);
                            }
                            Err(e) => {
                                status_msg = format!("Log failed: {}", e);
                            }
                        }
                        status_expiry = Instant::now() + Duration::from_secs(3);
                        tui::draw(&mut terminal, &metrics, selected_index, &status_msg)?;
                    }
                    _ => {}
                }
            }
        }

        if Instant::now() > status_expiry && !status_msg.is_empty() {
            status_msg.clear();
        }

        if last_tick.elapsed() >= REFRESH_INTERVAL {
            last_tick = Instant::now();
            metrics = collector.get_metrics();
            clamp_selected(&mut selected_index, &metrics);
            tui::draw(&mut terminal, &metrics, selected_index, &status_msg)?;
        }
    }

    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    Ok(())
}

fn clamp_selected(selected: &mut usize, metrics: &SystemMetrics) {
    let visible = metrics.processes.len().min(15);
    if *selected >= visible {
        *selected = visible.saturating_sub(1);
    }
}
