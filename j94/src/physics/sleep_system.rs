use crate::ecs::{System, World};
use crate::physics::{RigidBody, SleepState, Velocity};

pub struct SleepDetectionSystem;

impl System for SleepDetectionSystem {
    fn run(&mut self, world: &mut World, _delta_time: f32) {
        let query = world.query3_mut::<Velocity, RigidBody, SleepState>();
        for (_e, vel_ptr, body_ptr, sleep_ptr) in query {
            unsafe {
                let body = &*body_ptr;
                if body.is_static {
                    continue;
                }

                let vel = &mut *vel_ptr;
                let sleep = &mut *sleep_ptr;

                if sleep.sleeping {
                    vel.x = 0.0;
                    vel.y = 0.0;
                    continue;
                }

                if sleep.grounded_y {
                    vel.x = 0.0;
                    vel.y = 0.0;
                    sleep.tick_still();
                } else if vel.is_near_rest() {
                    vel.clamp_to_zero();
                    sleep.tick_still();
                } else {
                    vel.clamp_to_zero();
                    sleep.wake();
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

impl Default for SleepDetectionSystem {
    fn default() -> Self {
        Self
    }
}
