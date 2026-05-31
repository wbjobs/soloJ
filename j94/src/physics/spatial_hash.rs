use crate::ecs::Entity;
use crate::physics::{Collider, Position};

#[derive(Debug, Clone, Copy)]
pub struct GridEntry {
    pub entity: Entity,
    pub pos: Position,
    pub col: Collider,
}

pub struct SpatialHashGrid {
    cell_size: f32,
    table: std::collections::HashMap<i32, Vec<GridEntry>>,
}

impl SpatialHashGrid {
    pub fn new(cell_size: f32) -> Self {
        Self {
            cell_size,
            table: std::collections::HashMap::new(),
        }
    }

    pub fn clear(&mut self) {
        self.table.clear();
    }

    fn cell_coords(&self, x: f32, y: f32) -> (i32, i32) {
        (
            (x / self.cell_size).floor() as i32,
            (y / self.cell_size).floor() as i32,
        )
    }

    fn hash_key(cx: i32, cy: i32) -> i32 {
        (cx.wrapping_mul(73856093)) ^ (cy.wrapping_mul(19349663))
    }

    pub fn insert(&mut self, entity: Entity, pos: Position, col: Collider) {
        let r = col.radius;
        let (min_cx, min_cy) = self.cell_coords(pos.x - r, pos.y - r);
        let (max_cx, max_cy) = self.cell_coords(pos.x + r, pos.y + r);
        let entry = GridEntry { entity, pos, col };

        for cy in min_cy..=max_cy {
            for cx in min_cx..=max_cx {
                let key = Self::hash_key(cx, cy);
                self.table.entry(key).or_default().push(entry);
            }
        }
    }

    pub fn query(&self, pos: Position, col: Collider) -> Vec<GridEntry> {
        let r = col.radius;
        let (min_cx, min_cy) = self.cell_coords(pos.x - r, pos.y - r);
        let (max_cx, max_cy) = self.cell_coords(pos.x + r, pos.y + r);
        let mut result = Vec::new();

        for cy in min_cy..=max_cy {
            for cx in min_cx..=max_cx {
                let key = Self::hash_key(cx, cy);
                if let Some(entries) = self.table.get(&key) {
                    result.extend_from_slice(entries);
                }
            }
        }

        result
    }
}
