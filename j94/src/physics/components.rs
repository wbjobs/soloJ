use crate::ecs::Entity;

pub const VELOCITY_SLEEP_THRESHOLD: f32 = 1.0;
pub const VELOCITY_SLEEP_DETECT: f32 = 25.0;
pub const SLEEP_FRAMES_REQUIRED: u32 = 30;
pub const COLLISION_SLOP: f32 = 0.01;

#[derive(Debug, Clone, Copy)]
pub struct Position {
    pub x: f32,
    pub y: f32,
}

impl Position {
    pub fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Velocity {
    pub x: f32,
    pub y: f32,
}

impl Velocity {
    pub fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }

    pub fn zero() -> Self {
        Self { x: 0.0, y: 0.0 }
    }

    pub fn speed_sq(&self) -> f32 {
        self.x * self.x + self.y * self.y
    }

    pub fn is_below_threshold(&self) -> bool {
        self.speed_sq() < VELOCITY_SLEEP_THRESHOLD * VELOCITY_SLEEP_THRESHOLD
    }

    pub fn is_near_rest(&self) -> bool {
        self.speed_sq() < VELOCITY_SLEEP_DETECT * VELOCITY_SLEEP_DETECT
    }

    pub fn clamp_to_zero(&mut self) {
        if self.is_below_threshold() {
            self.x = 0.0;
            self.y = 0.0;
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct RigidBody {
    pub mass: f32,
    pub restitution: f32,
    pub is_static: bool,
}

impl RigidBody {
    pub fn new(mass: f32, restitution: f32) -> Self {
        Self {
            mass,
            restitution,
            is_static: false,
        }
    }

    pub fn static_body() -> Self {
        Self {
            mass: 0.0,
            restitution: 0.0,
            is_static: true,
        }
    }

    pub fn inv_mass(&self) -> f32 {
        if self.is_static || self.mass <= 0.0 {
            0.0
        } else {
            1.0 / self.mass
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct SleepState {
    pub sleeping: bool,
    pub still_frames: u32,
    pub grounded_y: bool,
}

impl SleepState {
    pub fn awake() -> Self {
        Self {
            sleeping: false,
            still_frames: 0,
            grounded_y: false,
        }
    }

    pub fn tick_still(&mut self) {
        if self.sleeping {
            return;
        }
        self.still_frames += 1;
        if self.still_frames >= SLEEP_FRAMES_REQUIRED {
            self.sleeping = true;
        }
    }

    pub fn wake(&mut self) {
        self.sleeping = false;
        self.still_frames = 0;
    }
}

#[derive(Debug, Clone, Copy)]
pub struct AABB {
    pub min_x: f32,
    pub min_y: f32,
    pub max_x: f32,
    pub max_y: f32,
}

impl AABB {
    pub fn from_center(center_x: f32, center_y: f32, half_width: f32, half_height: f32) -> Self {
        Self {
            min_x: center_x - half_width,
            min_y: center_y - half_height,
            max_x: center_x + half_width,
            max_y: center_y + half_height,
        }
    }

    pub fn width(&self) -> f32 {
        self.max_x - self.min_x
    }

    pub fn height(&self) -> f32 {
        self.max_y - self.min_y
    }

    pub fn center_x(&self) -> f32 {
        (self.min_x + self.max_x) * 0.5
    }

    pub fn center_y(&self) -> f32 {
        (self.min_y + self.max_y) * 0.5
    }

    pub fn intersects(&self, other: &AABB) -> bool {
        self.min_x < other.max_x
            && self.max_x > other.min_x
            && self.min_y < other.max_y
            && self.max_y > other.min_y
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Collider {
    pub radius: f32,
}

impl Collider {
    pub fn new(radius: f32) -> Self {
        Self { radius }
    }

    pub fn to_aabb(&self, pos: &Position) -> AABB {
        AABB::from_center(pos.x, pos.y, self.radius, self.radius)
    }
}

#[derive(Debug, Clone, Copy)]
pub struct CollisionEvent {
    pub a: Entity,
    pub b: Entity,
    pub normal_x: f32,
    pub normal_y: f32,
    pub depth: f32,
}

pub struct WorldBounds {
    pub min_x: f32,
    pub min_y: f32,
    pub max_x: f32,
    pub max_y: f32,
}

impl WorldBounds {
    pub fn new(width: f32, height: f32) -> Self {
        Self {
            min_x: 0.0,
            min_y: 0.0,
            max_x: width,
            max_y: height,
        }
    }
}
