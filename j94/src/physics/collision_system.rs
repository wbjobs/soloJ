use crate::ecs::{Entity, System, World};
use crate::physics::{
    Collider, CollisionEvent, CollisionStats, COLLISION_SLOP, Position, RigidBody, SleepState,
    SpatialHashGrid, Velocity, WorldBounds,
};

pub struct CollisionSystem {
    bounds: WorldBounds,
    gravity: f32,
    events: Vec<CollisionEvent>,
    grid: SpatialHashGrid,
    stats: CollisionStats,
    dry_run_results: Vec<(Entity, Entity)>,
    brute_force_frame_interval: u32,
    frame_counter: u32,
}

impl CollisionSystem {
    pub fn new(bounds: WorldBounds) -> Self {
        Self {
            bounds,
            gravity: 981.0,
            events: Vec::new(),
            grid: SpatialHashGrid::new(30.0),
            stats: CollisionStats::default(),
            dry_run_results: Vec::new(),
            brute_force_frame_interval: 120,
            frame_counter: 0,
        }
    }

    pub fn with_gravity(mut self, gravity: f32) -> Self {
        self.gravity = gravity;
        self
    }

    pub fn get_stats(&self) -> CollisionStats {
        self.stats
    }

    fn resolve_body_collision(
        pos_a: &mut Position,
        vel_a: &mut Velocity,
        body_a: &RigidBody,
        col_a: &Collider,
        sleep_a: &mut SleepState,
        pos_b: &mut Position,
        vel_b: &mut Velocity,
        body_b: &RigidBody,
        col_b: &Collider,
        sleep_b: &mut SleepState,
        gravity_dt: f32,
    ) {
        let dx = pos_b.x - pos_a.x;
        let dy = pos_b.y - pos_a.y;
        let dist_sq = dx * dx + dy * dy;
        let min_dist = col_a.radius + col_b.radius;

        if dist_sq >= min_dist * min_dist || dist_sq <= 0.0 {
            return;
        }

        let dist = dist_sq.sqrt();
        let nx = dx / dist;
        let ny = dy / dist;
        let overlap = min_dist - dist;

        let inv_mass_a = body_a.inv_mass();
        let inv_mass_b = body_b.inv_mass();
        let total_inv_mass = inv_mass_a + inv_mass_b;

        if total_inv_mass <= 0.0 {
            return;
        }

        let correction = (overlap - COLLISION_SLOP).max(0.0);

        if correction > 0.0 {
            if !body_a.is_static {
                pos_a.x -= nx * correction * (inv_mass_a / total_inv_mass);
                pos_a.y -= ny * correction * (inv_mass_a / total_inv_mass);
            }
            if !body_b.is_static {
                pos_b.x += nx * correction * (inv_mass_b / total_inv_mass);
                pos_b.y += ny * correction * (inv_mass_b / total_inv_mass);
            }
        }

        let rel_vel_x = vel_a.x - vel_b.x;
        let rel_vel_y = vel_a.y - vel_b.y;
        let vel_along_normal = rel_vel_x * nx + rel_vel_y * ny;

        if vel_along_normal > 0.0 {
            return;
        }

        let restitution = body_a.restitution.min(body_b.restitution);
        let impulse = -(1.0 + restitution) * vel_along_normal / total_inv_mass;

        if vel_along_normal.abs() < gravity_dt * 5.0 && overlap < COLLISION_SLOP * 10.0 {
            let resting_impulse = -vel_along_normal / total_inv_mass;
            let ri_x = resting_impulse * nx;
            let ri_y = resting_impulse * ny;
            if !body_a.is_static {
                vel_a.x += ri_x * inv_mass_a;
                vel_a.y += ri_y * inv_mass_a;
            }
            if !body_b.is_static {
                vel_b.x -= ri_x * inv_mass_b;
                vel_b.y -= ri_y * inv_mass_b;
            }

            let vel_along_normal_after = (vel_b.x - vel_a.x) * nx + (vel_b.y - vel_a.y) * ny;
            if vel_along_normal_after.abs() < gravity_dt * 2.0 {
                if !body_a.is_static {
                    vel_a.x -= vel_along_normal_after * nx * 0.5;
                    vel_a.y -= vel_along_normal_after * ny * 0.5;
                }
                if !body_b.is_static {
                    vel_b.x += vel_along_normal_after * nx * 0.5;
                    vel_b.y += vel_along_normal_after * ny * 0.5;
                }
            }

            if ny < -0.5 {
                sleep_a.grounded_y = true;
                if !body_a.is_static {
                    vel_a.y = vel_a.y.min(0.0);
                }
            } else if ny > 0.5 {
                sleep_b.grounded_y = true;
                if !body_b.is_static {
                    vel_b.y = vel_b.y.min(0.0);
                }
            }
            return;
        }

        let impulse_x = impulse * nx;
        let impulse_y = impulse * ny;

        if !body_a.is_static {
            vel_a.x += impulse_x * inv_mass_a;
            vel_a.y += impulse_y * inv_mass_a;
            sleep_a.wake();
        }
        if !body_b.is_static {
            vel_b.x -= impulse_x * inv_mass_b;
            vel_b.y -= impulse_y * inv_mass_b;
            sleep_b.wake();
        }
    }

    fn resolve_wall_collision(
        pos: &mut Position,
        vel: &mut Velocity,
        body: &RigidBody,
        col: &Collider,
        sleep: &mut SleepState,
        bounds: &WorldBounds,
        gravity_dt: f32,
    ) {
        if body.is_static {
            return;
        }

        let r = col.radius;
        let resting_threshold = gravity_dt * 5.0;

        if pos.x - r < bounds.min_x {
            pos.x = bounds.min_x + r;
            if vel.x.abs() < resting_threshold {
                vel.x = 0.0;
            } else {
                vel.x = -vel.x * body.restitution;
                sleep.wake();
            }
        } else if pos.x + r > bounds.max_x {
            pos.x = bounds.max_x - r;
            if vel.x.abs() < resting_threshold {
                vel.x = 0.0;
            } else {
                vel.x = -vel.x * body.restitution;
                sleep.wake();
            }
        }

        if pos.y - r < bounds.min_y {
            pos.y = bounds.min_y + r;
            if vel.y.abs() < resting_threshold {
                vel.y = 0.0;
                sleep.grounded_y = true;
            } else {
                vel.y = -vel.y * body.restitution;
                sleep.wake();
            }
        } else if pos.y + r > bounds.max_y {
            pos.y = bounds.max_y - r;
            if vel.y.abs() < resting_threshold {
                vel.y = 0.0;
                sleep.grounded_y = true;
            } else {
                vel.y = -vel.y * body.restitution;
                sleep.wake();
            }
        }
    }

    fn check_aabb_overlap(
        pos_a: &Position,
        col_a: &Collider,
        pos_b: &Position,
        col_b: &Collider,
    ) -> bool {
        let aabb_a = col_a.to_aabb(pos_a);
        let aabb_b = col_b.to_aabb(pos_b);
        aabb_a.intersects(&aabb_b)
    }
}

impl System for CollisionSystem {
    fn run(&mut self, world: &mut World, delta_time: f32) {
        self.events.clear();
        self.dry_run_results.clear();
        self.grid.clear();

        self.frame_counter = self.frame_counter.wrapping_add(1);
        let run_brute_force = self.frame_counter % self.brute_force_frame_interval == 0;

        let gravity_dt = self.gravity * delta_time;

        let entities: Vec<Entity> = world.entities_with::<Collider>().collect();
        let len = entities.len();

        let mut brute_checks: u32 = 0;
        let mut grid_checks: u32 = 0;

        // ==================== 暴力法 Dry Run（仅统计，不应用）====================
        if run_brute_force {
            let brute_start = std::time::Instant::now();
            for i in 0..len {
                let e_a = entities[i];
                let has_all_a = world.has_component::<Position>(e_a)
                    && world.has_component::<Velocity>(e_a)
                    && world.has_component::<RigidBody>(e_a)
                    && world.has_component::<Collider>(e_a)
                    && world.has_component::<SleepState>(e_a);

                if !has_all_a {
                    continue;
                }

                let sleep_a = world.get_component::<SleepState>(e_a).copied().unwrap();
                if sleep_a.sleeping {
                    continue;
                }

                let pos_a = world.get_component::<Position>(e_a).copied().unwrap();
                let col_a = world.get_component::<Collider>(e_a).copied().unwrap();

                for j in (i + 1)..len {
                    let e_b = entities[j];
                    let has_all_b = world.has_component::<Position>(e_b)
                        && world.has_component::<Velocity>(e_b)
                        && world.has_component::<RigidBody>(e_b)
                        && world.has_component::<Collider>(e_b)
                        && world.has_component::<SleepState>(e_b);

                    if !has_all_b {
                        continue;
                    }

                    let sleep_b = world.get_component::<SleepState>(e_b).copied().unwrap();
                    if sleep_a.sleeping && sleep_b.sleeping {
                        continue;
                    }

                    brute_checks += 1;

                    let pos_b = world.get_component::<Position>(e_b).copied().unwrap();
                    let col_b = world.get_component::<Collider>(e_b).copied().unwrap();

                    if !Self::check_aabb_overlap(&pos_a, &col_a, &pos_b, &col_b) {
                        continue;
                    }

                    let dx = pos_b.x - pos_a.x;
                    let dy = pos_b.y - pos_a.y;
                    let dist_sq = dx * dx + dy * dy;
                    let min_dist = col_a.radius + col_b.radius;

                    if dist_sq < min_dist * min_dist && dist_sq > 0.0 {
                        self.dry_run_results.push((e_a, e_b));
                    }
                }
            }
            self.stats.brute_force_us = brute_start.elapsed().as_micros() as u64;
            self.stats.brute_force_checks = brute_checks;
        }

        // ==================== 墙壁碰撞（所有实体，包括休眠的）====================
        for i in 0..len {
            let e_a = entities[i];
            let has_all_a = world.has_component::<Position>(e_a)
                && world.has_component::<Velocity>(e_a)
                && world.has_component::<RigidBody>(e_a)
                && world.has_component::<Collider>(e_a)
                && world.has_component::<SleepState>(e_a);

            if !has_all_a {
                continue;
            }

            let sleep_a = world.get_component::<SleepState>(e_a).copied().unwrap();
            let _pos_a = world.get_component::<Position>(e_a).copied().unwrap();
            let col_a = world.get_component::<Collider>(e_a).copied().unwrap();
            let body_a = world.get_component::<RigidBody>(e_a).copied().unwrap();

            {
                let pos_a_mut = world.get_component_mut::<Position>(e_a).unwrap() as *mut Position;
                let vel_a_mut = world.get_component_mut::<Velocity>(e_a).unwrap() as *mut Velocity;
                let sleep_a_mut =
                    world.get_component_mut::<SleepState>(e_a).unwrap() as *mut SleepState;
                unsafe {
                    Self::resolve_wall_collision(
                        &mut *pos_a_mut,
                        &mut *vel_a_mut,
                        &body_a,
                        &col_a,
                        &mut *sleep_a_mut,
                        &self.bounds,
                        gravity_dt,
                    );
                }
            }

            if sleep_a.sleeping {
                continue;
            }

            let updated_pos = world.get_component::<Position>(e_a).copied().unwrap();
            self.grid.insert(e_a, updated_pos, col_a);
        }

        // ==================== 空间哈希网格碰撞检测（实际应用）====================
        let grid_start = std::time::Instant::now();
        let mut processed = std::collections::HashSet::new();

        for i in 0..len {
            let e_a = entities[i];
            let has_all_a = world.has_component::<Position>(e_a)
                && world.has_component::<Velocity>(e_a)
                && world.has_component::<RigidBody>(e_a)
                && world.has_component::<Collider>(e_a)
                && world.has_component::<SleepState>(e_a);

            if !has_all_a {
                continue;
            }

            let sleep_a = world.get_component::<SleepState>(e_a).copied().unwrap();
            if sleep_a.sleeping {
                continue;
            }

            let pos_a = world.get_component::<Position>(e_a).copied().unwrap();
            let col_a = world.get_component::<Collider>(e_a).copied().unwrap();
            let body_a = world.get_component::<RigidBody>(e_a).copied().unwrap();

            let neighbors = self.grid.query(pos_a, col_a);

            for entry in neighbors {
                let e_b = entry.entity;
                if e_a.index() >= e_b.index() {
                    continue;
                }

                let pair_key = (e_a.index(), e_b.index());
                if processed.contains(&pair_key) {
                    continue;
                }
                processed.insert(pair_key);

                let has_all_b = world.has_component::<Position>(e_b)
                    && world.has_component::<Velocity>(e_b)
                    && world.has_component::<RigidBody>(e_b)
                    && world.has_component::<Collider>(e_b)
                    && world.has_component::<SleepState>(e_b);

                if !has_all_b {
                    continue;
                }

                let sleep_b = world.get_component::<SleepState>(e_b).copied().unwrap();
                if sleep_b.sleeping {
                    continue;
                }

                grid_checks += 1;

                let body_b = world.get_component::<RigidBody>(e_b).copied().unwrap();
                let pos_b = entry.pos;
                let col_b = entry.col;

                if !Self::check_aabb_overlap(&pos_a, &col_a, &pos_b, &col_b) {
                    continue;
                }

                let pos_a_mut = world.get_component_mut::<Position>(e_a).unwrap() as *mut Position;
                let vel_a_mut = world.get_component_mut::<Velocity>(e_a).unwrap() as *mut Velocity;
                let sleep_a_mut =
                    world.get_component_mut::<SleepState>(e_a).unwrap() as *mut SleepState;
                let pos_b_mut = world.get_component_mut::<Position>(e_b).unwrap() as *mut Position;
                let vel_b_mut = world.get_component_mut::<Velocity>(e_b).unwrap() as *mut Velocity;
                let sleep_b_mut =
                    world.get_component_mut::<SleepState>(e_b).unwrap() as *mut SleepState;

                unsafe {
                    Self::resolve_body_collision(
                        &mut *pos_a_mut,
                        &mut *vel_a_mut,
                        &body_a,
                        &col_a,
                        &mut *sleep_a_mut,
                        &mut *pos_b_mut,
                        &mut *vel_b_mut,
                        &body_b,
                        &col_b,
                        &mut *sleep_b_mut,
                        gravity_dt,
                    );
                }
            }
        }
        self.stats.spatial_grid_us = grid_start.elapsed().as_micros() as u64;
        self.stats.spatial_grid_checks = grid_checks;
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    fn as_any_mut(&mut self) -> &mut dyn std::any::Any {
        self
    }
}
