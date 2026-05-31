use crate::ecs::{System, World};
use crate::physics::{Position, RigidBody, SleepState, Velocity};

pub struct IntegrationSystem;

impl System for IntegrationSystem {
    fn run(&mut self, world: &mut World, delta_time: f32) {
        let query = world.query4_mut::<Position, Velocity, RigidBody, SleepState>();
        for (_e, pos_ptr, vel_ptr, body_ptr, sleep_ptr) in query {
            unsafe {
                let body = &*body_ptr;
                if body.is_static {
                    continue;
                }

                let sleep = &*sleep_ptr;
                let vel = &mut *vel_ptr;

                if sleep.sleeping {
                    vel.x = 0.0;
                    vel.y = 0.0;
                    continue;
                }

                let pos = &mut *pos_ptr;
                pos.x += vel.x * delta_time;
                pos.y += vel.y * delta_time;
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

impl Default for IntegrationSystem {
    fn default() -> Self {
        Self
    }
}
