use ratatui::{
    backend::CrosstermBackend,
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    symbols,
    text::{Line, Span},
    widgets::{Axis, Block, Borders, Cell, Chart, Dataset, Gauge, Paragraph, Row, Table, Wrap},
    Terminal,
};
use unicode_width::UnicodeWidthStr;

use crate::metrics::{format_bytes, format_uptime, SystemMetrics};

pub fn draw(
    terminal: &mut Terminal<CrosstermBackend<std::io::Stdout>>,
    metrics: &SystemMetrics,
    selected_index: usize,
    status_msg: &str,
) -> std::io::Result<()> {
    terminal.draw(|frame| {
        let size = frame.size();

        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .margin(1)
            .constraints(
                [
                    Constraint::Length(3),
                    Constraint::Length(12),
                    Constraint::Length(8),
                    Constraint::Min(10),
                    Constraint::Length(1),
                ]
                .as_ref(),
            )
            .split(size);

        draw_header(frame, chunks[0], metrics);
        draw_cpu_chart(frame, chunks[1], metrics);
        draw_memory_bars(frame, chunks[2], metrics);
        draw_process_table(frame, chunks[3], metrics, selected_index);
        draw_status_bar(
            frame,
            chunks[4],
            selected_index,
            metrics.processes.len(),
            status_msg,
        );
    })?;

    Ok(())
}

fn truncate_to_width(s: &str, max_width: usize) -> String {
    if max_width == 0 {
        return String::new();
    }
    let display_width = UnicodeWidthStr::width(s);
    if display_width <= max_width {
        return s.to_string();
    }
    let mut result = String::new();
    let mut current_width = 0;
    for ch in s.chars() {
        let char_width = unicode_width::UnicodeWidthChar::width(ch).unwrap_or(0);
        if current_width + char_width > max_width {
            break;
        }
        result.push(ch);
        current_width += char_width;
    }

    if current_width > 0 && current_width < max_width {
        let pad = max_width - current_width;
        result.extend(std::iter::repeat(' ').take(pad.min(3)));
    }
    result
}

fn pad_to_width(s: &str, target_width: usize) -> String {
    let display_width = UnicodeWidthStr::width(s);
    if display_width >= target_width {
        return s.to_string();
    }
    let padding = target_width - display_width;
    format!("{}{}", s, " ".repeat(padding))
}

fn draw_header(frame: &mut ratatui::Frame, area: Rect, metrics: &SystemMetrics) {
    let header_text = vec![Line::from(vec![
        Span::styled(
            " rtop ",
            Style::default()
                .fg(Color::Black)
                .bg(Color::Green)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw("  "),
        Span::styled(
            format!(" Uptime: {} ", format_uptime(metrics.uptime)),
            Style::default().fg(Color::Cyan),
        ),
        Span::raw("  "),
        Span::styled(
            format!(" {} ", metrics.time),
            Style::default().fg(Color::Yellow),
        ),
    ])];

    let header = Paragraph::new(header_text)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::DarkGray)),
        )
        .alignment(Alignment::Left)
        .wrap(Wrap { trim: true });

    frame.render_widget(header, area);
}

fn draw_cpu_chart(frame: &mut ratatui::Frame, area: Rect, metrics: &SystemMetrics) {
    let data: Vec<(f64, f64)> = metrics
        .cpu_history
        .iter()
        .enumerate()
        .map(|(i, &v)| (i as f64, v as f64))
        .collect();

    let dataset = Dataset::default()
        .name(format!("CPU: {:.1}%", metrics.cpu_usage))
        .marker(symbols::Marker::Braille)
        .style(Style::default().fg(Color::Green))
        .data(&data);

    let x_labels = vec![
        Span::styled("0s", Style::default().fg(Color::Gray)),
        Span::styled(
            format!("{}s", metrics.cpu_history.len()),
            Style::default().fg(Color::Gray),
        ),
    ];

    let y_labels = vec![
        Span::styled("0%", Style::default().fg(Color::Gray)),
        Span::styled("50%", Style::default().fg(Color::Gray)),
        Span::styled("100%", Style::default().fg(Color::Gray)),
    ];

    let chart = Chart::new(vec![dataset])
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::DarkGray))
                .title(Span::styled(
                    " CPU Usage ",
                    Style::default()
                        .fg(Color::Green)
                        .add_modifier(Modifier::BOLD),
                )),
        )
        .x_axis(
            Axis::default()
                .style(Style::default().fg(Color::Gray))
                .labels(x_labels),
        )
        .y_axis(
            Axis::default()
                .style(Style::default().fg(Color::Gray))
                .labels(y_labels)
                .bounds([0.0, 100.0]),
        )
        .hidden_legend_constraints((Constraint::Ratio(1, 1), Constraint::Ratio(1, 1)));

    frame.render_widget(chart, area);
}

fn draw_memory_bars(frame: &mut ratatui::Frame, area: Rect, metrics: &SystemMetrics) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(4), Constraint::Length(4)])
        .margin(1)
        .split(area);

    let memory_color = if metrics.memory_percent > 80.0 {
        Color::Red
    } else if metrics.memory_percent > 60.0 {
        Color::Yellow
    } else {
        Color::Blue
    };

    let memory_gauge = Gauge::default()
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::DarkGray))
                .title(Span::styled(
                    format!(
                        " Memory: {} / {} ",
                        format_bytes(metrics.memory_used),
                        format_bytes(metrics.memory_total)
                    ),
                    Style::default()
                        .fg(memory_color)
                        .add_modifier(Modifier::BOLD),
                )),
        )
        .gauge_style(
            Style::default()
                .fg(memory_color)
                .bg(Color::Black)
                .add_modifier(Modifier::BOLD),
        )
        .label(format!("{:.1}%", metrics.memory_percent))
        .ratio(metrics.memory_percent as f64 / 100.0);

    frame.render_widget(memory_gauge, chunks[0]);

    let swap_color = if metrics.swap_percent > 80.0 {
        Color::Red
    } else if metrics.swap_percent > 60.0 {
        Color::Yellow
    } else {
        Color::Magenta
    };

    let swap_gauge = Gauge::default()
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::DarkGray))
                .title(Span::styled(
                    format!(
                        " Swap: {} / {} ",
                        format_bytes(metrics.swap_used),
                        format_bytes(metrics.swap_total)
                    ),
                    Style::default().fg(swap_color).add_modifier(Modifier::BOLD),
                )),
        )
        .gauge_style(
            Style::default()
                .fg(swap_color)
                .bg(Color::Black)
                .add_modifier(Modifier::BOLD),
        )
        .label(format!("{:.1}%", metrics.swap_percent))
        .ratio(if metrics.swap_total > 0 {
            metrics.swap_percent as f64 / 100.0
        } else {
            0.0
        });

    frame.render_widget(swap_gauge, chunks[1]);
}

fn draw_process_table(
    frame: &mut ratatui::Frame,
    area: Rect,
    metrics: &SystemMetrics,
    selected_index: usize,
) {
    let visible_count = metrics.processes.len().min(15);

    let available_width = area.width.saturating_sub(2) as usize;
    let column_spacing = 2;
    let total_spacing = column_spacing * 4;

    let usable = available_width.saturating_sub(total_spacing);
    let pid_w = 8.min(usable);
    let remaining = usable.saturating_sub(pid_w);
    let cpu_w = 8.min(remaining);
    let remaining = remaining.saturating_sub(cpu_w);
    let mem_w = 10.min(remaining);
    let remaining = remaining.saturating_sub(mem_w);
    let status_w = 8.min(remaining);
    let name_w = remaining.saturating_sub(status_w);

    let header_cells = ["PID", "NAME", "CPU %", "MEMORY", "STATUS"]
        .iter()
        .map(|h| {
            Cell::from(*h).style(
                Style::default()
                    .fg(Color::Cyan)
                    .add_modifier(Modifier::BOLD),
            )
        });

    let header = Row::new(header_cells)
        .style(Style::default().bg(Color::DarkGray))
        .height(1);

    let rows = metrics.processes.iter().take(15).enumerate().map(|(i, p)| {
        let is_selected = i == selected_index;

        let cpu_color = if p.cpu > 80.0 {
            Color::Red
        } else if p.cpu > 50.0 {
            Color::Yellow
        } else {
            Color::Reset
        };

        let name_display = truncate_to_width(&p.name, name_w);
        let status_display = truncate_to_width(&p.status, status_w);

        let base_style = if is_selected {
            Style::default()
                .bg(Color::DarkGray)
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default()
        };

        let cells = vec![
            Cell::from(pad_to_width(&format!("{}", p.pid), pid_w)).style(base_style),
            Cell::from(name_display).style(base_style.fg(if is_selected {
                Color::White
            } else {
                Color::Reset
            })),
            Cell::from(pad_to_width(&format!("{:.1}", p.cpu), cpu_w))
                .style(base_style.fg(cpu_color)),
            Cell::from(pad_to_width(&format_bytes(p.memory), mem_w)).style(base_style),
            Cell::from(status_display).style(base_style),
        ];

        let mut row = Row::new(cells).height(1);
        if is_selected {
            row = row.style(
                Style::default()
                    .bg(Color::DarkGray)
                    .add_modifier(Modifier::BOLD),
            );
        }
        row
    });

    let widths = [
        Constraint::Length(pid_w as u16),
        Constraint::Length(name_w as u16),
        Constraint::Length(cpu_w as u16),
        Constraint::Length(mem_w as u16),
        Constraint::Length(status_w as u16),
    ];

    let table = Table::new(rows)
        .header(header)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::DarkGray))
                .title(Span::styled(
                    format!(" Processes (Top {} by CPU) ", visible_count),
                    Style::default()
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::BOLD),
                )),
        )
        .widths(&widths)
        .column_spacing(column_spacing as u16);

    frame.render_widget(table, area);
}

fn draw_status_bar(
    frame: &mut ratatui::Frame,
    area: Rect,
    selected_index: usize,
    total_processes: usize,
    status_msg: &str,
) {
    let visible = total_processes.min(15);
    let selected_info = if visible > 0 && selected_index < visible {
        format!("{}/{}", selected_index + 1, visible)
    } else {
        format!("0/{}", visible)
    };

    let spans = vec![
        Span::styled(
            " [q]uit  [\u{2191}/\u{2193}]nav  [k]ill  [l]og ",
            Style::default().fg(Color::Gray),
        ),
        Span::raw("  "),
        Span::styled(
            format!(" Selected: {} ", selected_info),
            Style::default().fg(Color::Cyan),
        ),
        Span::raw("  "),
        Span::styled(status_msg.to_string(), Style::default().fg(Color::Yellow)),
    ];

    let status_bar = Paragraph::new(Line::from(spans));
    frame.render_widget(status_bar, area);
}
