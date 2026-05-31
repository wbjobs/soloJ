use crate::ecs::{System, World};
use crate::physics::{RigidBody, SleepState, Velocity};

pub struct GravitySystem {
    pub gravity: f32,
}

impl GravitySystem {
    pub fn new(gravity: f32) -> Self {
        Self { gravity }
    }

    pub fn earth() -> Self {
        Self::new(981.0)
    }
}

impl System for GravitySystem {
    fn run(&mut self, world: &mut World, delta_time: f32) {
        let query = world.query3_mut::<Velocity, RigidBody, SleepState>();
        for (_e, vel_ptr, body_ptr, sleep_ptr) in query {
            unsafe {
                let body = &*body_ptr;
                let sleep = &mut *sleep_ptr;
                if body.is_static {
                    continue;
                }

                if sleep.sleeping {
                    continue;
                }

                let was_grounded_y = sleep.grounded_y;
                if !was_grounded_y {
                    sleep.grounded_y = false;
                }

                let vel = &mut *vel_ptr;
                if !was_grounded_y {
                    vel.y += self.gravity * delta_time;
                }
            }
        }
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    fn as_any_mut(&mut self) -> &mut dyn std::any::Any {
        self
    }
}

impl Default for GravitySystem {
    fn default() -> Self {
        Self::earth()
    }
}
