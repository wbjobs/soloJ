use minifb::{Key, Window, WindowOptions};

use crate::ecs::{System, World};
use crate::physics::{Collider, CollisionStats, Position};

#[derive(Debug, Clone, Copy)]
pub struct BallColor {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

impl BallColor {
    pub fn new(r: u8, g: u8, b: u8) -> Self {
        Self { r, g, b }
    }

    pub fn random() -> Self {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        Self {
            r: rng.gen_range(50..=255),
            g: rng.gen_range(50..=255),
            b: rng.gen_range(50..=255),
        }
    }

    pub fn to_u32(&self) -> u32 {
        ((self.r as u32) << 16) | ((self.g as u32) << 8) | (self.b as u32)
    }
}

pub struct RenderSystem {
    window: Window,
    width: usize,
    height: usize,
    buffer: Vec<u32>,
}

impl RenderSystem {
    pub fn new(width: u32, height: u32, title: &str) -> Result<Self, String> {
        let window = Window::new(
            title,
            width as usize,
            height as usize,
            WindowOptions {
                resize: true,
                title: true,
                ..WindowOptions::default()
            },
        )
        .map_err(|e| e.to_string())?;

        let buffer = vec![0; (width * height) as usize];

        Ok(Self {
            window,
            width: width as usize,
            height: height as usize,
            buffer,
        })
    }

    pub fn poll_quit(&mut self) -> bool {
        self.window.is_key_down(Key::Escape) || !self.window.is_open()
    }

    fn clear(&mut self, color: u32) {
        for pixel in self.buffer.iter_mut() {
            *pixel = color;
        }
    }

    fn draw_pixel(&mut self, x: i32, y: i32, color: u32) {
        if x >= 0 && x < self.width as i32 && y >= 0 && y < self.height as i32 {
            let idx = (y as usize) * self.width + (x as usize);
            self.buffer[idx] = color;
        }
    }

    fn draw_ball(&mut self, x: f32, y: f32, radius: f32, color: BallColor) {
        let center_x = x as i32;
        let center_y = self.height as i32 - (y as i32);
        let r = radius as i32;
        let color_u32 = color.to_u32();
        let border_color = BallColor::new(
            color.r.saturating_sub(40),
            color.g.saturating_sub(40),
            color.b.saturating_sub(40),
        )
        .to_u32();

        for dy in -r..=r {
            let dx_max = (r * r - dy * dy) as f32;
            let dx_max = dx_max.sqrt() as i32;
            for dx in -dx_max..=dx_max {
                let px = center_x + dx;
                let py = center_y + dy;
                self.draw_pixel(px, py, color_u32);
            }
        }

        let mut angle = 0.0;
        while angle < 360.0 {
            let rad = angle * std::f32::consts::PI / 180.0;
            let px = center_x as f32 + rad.cos() * radius;
            let py = center_y as f32 + rad.sin() * radius;
            self.draw_pixel(px as i32, py as i32, border_color);
            angle += 2.0;
        }
    }

    fn draw_text(&mut self, text: &str, x: i32, y: i32, scale: i32, color: u32) {
        let bg_color = 0x000000;
        let text_width = text.len() as i32 * 8 * scale;
        let text_height = 8 * scale;

        for py in -2..text_height + 2 {
            for px in -2..text_width + 2 {
                self.draw_pixel(x + px, y + py, bg_color);
            }
        }

        let mut cx = x;
        for c in text.chars() {
            self.draw_char(c, cx, y, scale, color);
            cx += 8 * scale;
        }
    }

    fn char_pattern(c: char) -> [[bool; 5]; 7] {
        match c {
            '0' => [
                [false, true, true, true, false],
                [true, false, false, false, true],
                [true, false, false, true, true],
                [true, false, true, false, true],
                [true, true, false, false, true],
                [true, false, false, false, true],
                [false, true, true, true, false],
            ],
            '1' => [
                [false, false, true, false, false],
                [false, true, true, false, false],
                [false, false, true, false, false],
                [false, false, true, false, false],
                [false, false, true, false, false],
                [false, false, true, false, false],
                [false, true, true, true, false],
            ],
            '2' => [
                [false, true, true, true, false],
                [true, false, false, false, true],
                [false, false, false, false, true],
                [false, false, false, true, false],
                [false, false, true, false, false],
                [false, true, false, false, false],
                [true, true, true, true, true],
            ],
            '3' => [
                [false, true, true, true, false],
                [true, false, false, false, true],
                [false, false, false, false, true],
                [false, false, true, true, false],
                [false, false, false, false, true],
                [true, false, false, false, true],
                [false, true, true, true, false],
            ],
            '4' => [
                [false, false, false, true, false],
                [false, false, true, true, false],
                [false, true, false, true, false],
                [true, false, false, true, false],
                [true, true, true, true, true],
                [false, false, false, true, false],
                [false, false, false, true, false],
            ],
            '5' => [
                [true, true, true, true, true],
                [true, false, false, false, false],
                [true, true, true, true, false],
                [false, false, false, false, true],
                [false, false, false, false, true],
                [true, false, false, false, true],
                [false, true, true, true, false],
            ],
            '6' => [
                [false, true, true, true, false],
                [true, false, false, false, false],
                [true, false, false, false, false],
                [true, true, true, true, false],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [false, true, true, true, false],
            ],
            '7' => [
                [true, true, true, true, true],
                [false, false, false, false, true],
                [false, false, false, true, false],
                [false, false, true, false, false],
                [false, true, false, false, false],
                [false, true, false, false, false],
                [false, true, false, false, false],
            ],
            '8' => [
                [false, true, true, true, false],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [false, true, true, true, false],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [false, true, true, true, false],
            ],
            '9' => [
                [false, true, true, true, false],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [false, true, true, true, true],
                [false, false, false, false, true],
                [false, false, false, false, true],
                [false, true, true, true, false],
            ],
            '.' => [
                [false, false, false, false, false],
                [false, false, false, false, false],
                [false, false, false, false, false],
                [false, false, false, false, false],
                [false, false, false, false, false],
                [false, false, true, false, false],
                [false, false, true, false, false],
            ],
            'F' => [
                [true, true, true, true, true],
                [true, false, false, false, false],
                [true, false, false, false, false],
                [true, true, true, true, false],
                [true, false, false, false, false],
                [true, false, false, false, false],
                [true, false, false, false, false],
            ],
            'P' => [
                [true, true, true, true, false],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [true, true, true, true, false],
                [true, false, false, false, false],
                [true, false, false, false, false],
                [true, false, false, false, false],
            ],
            'S' => [
                [false, true, true, true, false],
                [true, false, false, false, true],
                [true, false, false, false, false],
                [false, true, true, true, false],
                [false, false, false, false, true],
                [true, false, false, false, true],
                [false, true, true, true, false],
            ],
            'u' => [
                [false, false, false, false, false],
                [false, false, false, false, false],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [false, true, true, true, false],
            ],
            's' => [
                [false, false, false, false, false],
                [false, false, false, false, false],
                [false, true, true, true, false],
                [true, false, false, false, false],
                [false, true, true, true, false],
                [false, false, false, false, true],
                [true, true, true, true, false],
            ],
            ' ' => [[false; 5]; 7],
            ':' => [
                [false, false, false, false, false],
                [false, false, true, false, false],
                [false, false, true, false, false],
                [false, false, false, false, false],
                [false, false, true, false, false],
                [false, false, true, false, false],
                [false, false, false, false, false],
            ],
            'm' => [
                [false, false, false, false, false],
                [false, false, false, false, false],
                [true, true, false, true, true],
                [true, false, true, false, true],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [true, false, false, false, true],
            ],
            'n' => [
                [false, false, false, false, false],
                [false, false, false, false, false],
                [true, true, false, false, false],
                [true, false, true, false, false],
                [true, false, false, true, false],
                [true, false, false, false, true],
                [true, false, false, false, true],
            ],
            'i' => [
                [false, false, true, false, false],
                [false, false, true, false, false],
                [false, false, false, false, false],
                [false, false, true, false, false],
                [false, false, true, false, false],
                [false, false, true, false, false],
                [false, false, true, false, false],
            ],
            't' => [
                [false, false, false, false, false],
                [false, false, false, false, false],
                [false, false, true, false, false],
                [true, true, true, true, true],
                [false, false, true, false, false],
                [false, false, true, false, false],
                [false, true, false, false, false],
            ],
            'e' => [
                [false, false, false, false, false],
                [false, false, false, false, false],
                [false, true, true, true, false],
                [true, false, false, false, true],
                [true, true, true, true, true],
                [true, false, false, false, false],
                [false, true, true, true, false],
            ],
            'r' => [
                [false, false, false, false, false],
                [false, false, false, false, false],
                [true, true, true, true, false],
                [true, false, false, false, true],
                [true, false, false, false, false],
                [true, false, false, false, false],
                [true, false, false, false, false],
            ],
            'a' => [
                [false, false, false, false, false],
                [false, false, false, false, false],
                [false, true, true, true, false],
                [false, false, false, false, true],
                [false, true, true, true, true],
                [true, false, false, false, true],
                [false, true, true, true, true],
            ],
            'h' => [
                [false, false, false, false, false],
                [false, false, false, false, false],
                [true, false, false, false, false],
                [true, false, false, false, false],
                [true, true, true, true, false],
                [true, false, false, false, true],
                [true, false, false, false, true],
            ],
            'y' => [
                [false, false, false, false, false],
                [false, false, false, false, false],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [false, true, false, true, false],
                [false, false, true, false, false],
                [false, false, true, false, false],
            ],
            'p' => [
                [false, false, false, false, false],
                [false, false, false, false, false],
                [true, true, true, true, false],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [true, true, true, true, false],
                [true, false, false, false, false],
            ],
            'o' => [
                [false, false, false, false, false],
                [false, false, false, false, false],
                [false, true, true, true, false],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [false, true, true, true, false],
            ],
            'c' => [
                [false, false, false, false, false],
                [false, false, false, false, false],
                [false, true, true, true, false],
                [true, false, false, false, false],
                [true, false, false, false, false],
                [true, false, false, false, false],
                [false, true, true, true, false],
            ],
            'l' => [
                [false, false, false, false, false],
                [false, false, false, false, false],
                [false, true, true, false, false],
                [false, false, true, false, false],
                [false, false, true, false, false],
                [false, false, true, false, false],
                [false, true, true, true, false],
            ],
            'd' => [
                [false, false, false, false, false],
                [false, false, false, false, false],
                [true, true, true, true, false],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [true, true, true, true, false],
            ],
            'H' => [
                [true, false, false, false, true],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [true, true, true, true, true],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [true, false, false, false, true],
            ],
            'G' => [
                [false, true, true, true, false],
                [true, false, false, false, true],
                [true, false, false, false, false],
                [true, false, true, true, true],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [false, true, true, true, false],
            ],
            '/' => [
                [false, false, false, false, true],
                [false, false, false, true, false],
                [false, false, true, false, false],
                [false, true, false, false, false],
                [true, false, false, false, false],
                [false, false, false, false, false],
                [false, false, false, false, false],
            ],
            '%' => [
                [true, false, false, false, true],
                [true, false, false, true, false],
                [false, false, true, false, false],
                [false, true, false, false, false],
                [true, false, false, false, true],
                [false, false, false, false, false],
                [false, false, false, false, false],
            ],
            'O' => [
                [false, true, true, true, false],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [false, true, true, true, false],
            ],
            'N' => [
                [true, false, false, false, true],
                [true, true, false, false, true],
                [true, false, true, false, true],
                [true, false, false, true, true],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [true, false, false, false, true],
            ],
            'C' => [
                [false, true, true, true, false],
                [true, false, false, false, true],
                [true, false, false, false, false],
                [true, false, false, false, false],
                [true, false, false, false, false],
                [true, false, false, false, true],
                [false, true, true, true, false],
            ],
            'k' => [
                [false, false, false, false, false],
                [false, false, false, false, false],
                [true, false, false, true, false],
                [true, false, true, false, false],
                [true, true, false, false, false],
                [true, false, true, false, false],
                [true, false, false, true, false],
            ],
            'B' => [
                [true, true, true, true, false],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [true, true, true, true, false],
                [true, false, false, false, true],
                [true, false, false, false, true],
                [true, true, true, true, false],
            ],
            'f' => [
                [false, false, true, true, false],
                [false, true, false, false, false],
                [true, true, true, true, false],
                [false, true, false, false, false],
                [false, true, false, false, false],
                [false, true, false, false, false],
                [false, true, false, false, false],
            ],
            'x' => [
                [false, false, false, false, false],
                [false, false, false, false, false],
                [true, false, false, false, true],
                [false, true, false, true, false],
                [false, false, true, false, false],
                [false, true, false, true, false],
                [true, false, false, false, true],
            ],
            _ => [[false; 5]; 7],
        }
    }

    fn draw_char(&mut self, c: char, x: i32, y: i32, scale: i32, color: u32) {
        let pattern = Self::char_pattern(c);

        for (row_idx, row) in pattern.iter().enumerate() {
            for (col_idx, &pixel) in row.iter().enumerate() {
                if pixel {
                    for sy in 0..scale {
                        for sx in 0..scale {
                            let px = x + (col_idx as i32) * scale + sx;
                            let py = y + (row_idx as i32) * scale + sy;
                            self.draw_pixel(px, py, color);
                        }
                    }
                }
            }
        }
    }

    pub fn render(
        &mut self,
        world: &World,
        fps: f32,
        physics_time_us: u64,
        system_timings: &[(&'static str, std::time::Duration)],
        collision_stats: CollisionStats,
    ) -> Result<(), String> {
        let new_size = self.window.get_size();
        if new_size.0 != self.width || new_size.1 != self.height {
            self.width = new_size.0;
            self.height = new_size.1;
            self.buffer.resize(self.width * self.height, 0);
        }

        self.clear(0x1E1E32);

        for (entity, pos) in world.query::<Position>() {
            if let (Some(col), Some(color)) = (
                world.get_component::<Collider>(entity),
                world.get_component::<BallColor>(entity),
            ) {
                self.draw_ball(pos.x, pos.y, col.radius, *color);
            }
        }

        let white = 0xFFFFFF;
        let yellow = 0xFFFF00;
        let cyan = 0x00FFFF;
        let green = 0x00FF00;
        let red = 0xFF6666;

        self.draw_text(&format!("FPS: {:.1}", fps), 10, 10, 2, white);
        self.draw_text(
            &format!("Physics: {} us", physics_time_us),
            10,
            35,
            2,
            white,
        );

        let mut y_offset = 70;
        for (name, duration) in system_timings {
            let short_name = name.split("::").last().unwrap_or(name);
            let us = duration.as_micros();
            self.draw_text(
                &format!("{}: {} us", short_name, us),
                10,
                y_offset,
                1,
                white,
            );
            y_offset += 12;
        }

        // ==================== 碰撞性能对比面板 ====================
        let panel_x = (self.width as i32) - 320;
        let panel_y = 10;

        // 绘制面板背景
        for py in 0..140 {
            for px in 0..310 {
                self.draw_pixel(panel_x + px, panel_y + py, 0x0A0A1A);
            }
        }

        // 边框
        for px in 0..310 {
            self.draw_pixel(panel_x + px, panel_y, 0x4444AA);
            self.draw_pixel(panel_x + px, panel_y + 139, 0x4444AA);
        }
        for py in 0..140 {
            self.draw_pixel(panel_x, panel_y + py, 0x4444AA);
            self.draw_pixel(panel_x + 309, panel_y + py, 0x4444AA);
        }

        self.draw_text(
            "Collision Performance",
            panel_x + 10,
            panel_y + 8,
            2,
            yellow,
        );

        // 暴力法统计
        self.draw_text(
            &format!(
                "Brute Force: {} us",
                collision_stats.brute_force_us
            ),
            panel_x + 10,
            panel_y + 40,
            1,
            red,
        );
        self.draw_text(
            &format!(
                "  Checks: {}",
                collision_stats.brute_force_checks
            ),
            panel_x + 10,
            panel_y + 55,
            1,
            red,
        );

        // 空间哈希网格统计
        self.draw_text(
            &format!(
                "Spatial Grid: {} us",
                collision_stats.spatial_grid_us
            ),
            panel_x + 10,
            panel_y + 75,
            1,
            green,
        );
        self.draw_text(
            &format!(
                "  Checks: {}",
                collision_stats.spatial_grid_checks
            ),
            panel_x + 10,
            panel_y + 90,
            1,
            green,
        );

        // 加速比
        let speedup = if collision_stats.spatial_grid_us > 0 {
            collision_stats.brute_force_us as f32 / collision_stats.spatial_grid_us as f32
        } else {
            0.0
        };
        let check_ratio = if collision_stats.spatial_grid_checks > 0 {
            collision_stats.brute_force_checks as f32 / collision_stats.spatial_grid_checks as f32
        } else {
            0.0
        };

        self.draw_text(
            &format!("Speedup: {:.1}x  ({:.1}x fewer checks)", speedup, check_ratio),
            panel_x + 10,
            panel_y + 115,
            1,
            cyan,
        );

        self.window
            .update_with_buffer(&self.buffer, self.width, self.height)
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}

impl System for RenderSystem {
    fn run(&mut self, _world: &mut World, _delta_time: f32) {}

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    fn as_any_mut(&mut self) -> &mut dyn std::any::Any {
        self
    }
}
