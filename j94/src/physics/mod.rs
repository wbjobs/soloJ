pub mod components;
pub mod gravity_system;
pub mod integration_system;
pub mod collision_system;
pub mod sleep_system;
pub mod spatial_hash;

pub use components::{
    Position, Velocity, RigidBody, AABB, Collider, CollisionEvent, WorldBounds, SleepState,
    VELOCITY_SLEEP_THRESHOLD, VELOCITY_SLEEP_DETECT, SLEEP_FRAMES_REQUIRED, COLLISION_SLOP,
};
pub use gravity_system::GravitySystem;
pub use integration_system::IntegrationSystem;
pub use collision_system::CollisionSystem;
pub use sleep_system::SleepDetectionSystem;
pub use spatial_hash::{SpatialHashGrid, GridEntry};

#[derive(Debug, Clone, Copy, Default)]
pub struct CollisionStats {
    pub brute_force_us: u64,
    pub spatial_grid_us: u64,
    pub brute_force_checks: u32,
    pub spatial_grid_checks: u32,
}

