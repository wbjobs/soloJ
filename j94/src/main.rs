pub mod ecs;
pub mod physics;
pub mod render;

use rand::Rng;

use crate::ecs::{SystemManager, World};
use crate::physics::{
    Collider, CollisionSystem, GravitySystem, IntegrationSystem, Position, RigidBody,
    SleepDetectionSystem, SleepState, Velocity, WorldBounds,
};
use crate::render::{BallColor, RenderSystem};

const WINDOW_WIDTH: u32 = 1200;
const WINDOW_HEIGHT: u32 = 800;
const BALL_COUNT: usize = 1000;
const FIXED_DT: f32 = 1.0 / 120.0;
const MAX_PHYSICS_STEPS: u32 = 5;

fn create_balls(world: &mut World, count: usize) {
    let mut rng = rand::thread_rng();

    for _ in 0..count {
        let entity = world.create_entity();

        let radius = rng.gen_range(4.0_f32..=10.0);
        let x = rng.gen_range(radius..(WINDOW_WIDTH as f32 - radius));
        let y = rng.gen_range(radius..(WINDOW_HEIGHT as f32 * 0.3));

        let vx = rng.gen_range(-50.0_f32..=50.0);
        let vy = rng.gen_range(-20.0_f32..=20.0);

        let mass = radius * radius * 0.5;
        let restitution = rng.gen_range(0.4_f32..=0.8);

        world.add_component(entity, Position::new(x, y));
        world.add_component(entity, Velocity::new(vx, vy));
        world.add_component(entity, RigidBody::new(mass, restitution));
        world.add_component(entity, Collider::new(radius));
        world.add_component(entity, SleepState::awake());
        world.add_component(entity, BallColor::random());
    }
}

struct FpsCounter {
    frames: u32,
    last_time: std::time::Instant,
    current_fps: f32,
}

impl FpsCounter {
    fn new() -> Self {
        Self {
            frames: 0,
            last_time: std::time::Instant::now(),
            current_fps: 0.0,
        }
    }

    fn tick(&mut self) -> f32 {
        self.frames += 1;
        let elapsed = self.last_time.elapsed();
        if elapsed.as_secs_f32() >= 0.5 {
            self.current_fps = self.frames as f32 / elapsed.as_secs_f32();
            self.frames = 0;
            self.last_time = std::time::Instant::now();
        }
        self.current_fps
    }
}

fn main() -> Result<(), String> {
    println!("Initializing ECS Physics Sandbox...");
    println!("Window: {}x{}", WINDOW_WIDTH, WINDOW_HEIGHT);
    println!("Balls: {}", BALL_COUNT);

    let mut world = World::new();

    create_balls(&mut world, BALL_COUNT);

    let bounds = WorldBounds::new(WINDOW_WIDTH as f32, WINDOW_HEIGHT as f32);

    let mut system_manager = SystemManager::new();
    system_manager.add(GravitySystem::earth());
    system_manager.add(IntegrationSystem);
    system_manager.add(CollisionSystem::new(bounds));
    system_manager.add(SleepDetectionSystem);

    let mut render_system =
        RenderSystem::new(WINDOW_WIDTH, WINDOW_HEIGHT, "ECS 2D Physics Sandbox")?;

    let mut fps_counter = FpsCounter::new();
    let mut last_frame_time = std::time::Instant::now();
    let mut accumulator = 0.0;
    let mut physics_time_us: u64;
    let mut system_timings: Vec<(&'static str, std::time::Duration)> = Vec::new();

    println!("Starting main loop...");
    println!("Press ESC to quit");

    loop {
        if render_system.poll_quit() {
            println!("Quit signal received. Exiting...");
            break;
        }

        let now = std::time::Instant::now();
        let frame_time = (now - last_frame_time).as_secs_f32().min(0.25);
        last_frame_time = now;

        accumulator += frame_time;

        let mut steps = 0;
        let physics_start = std::time::Instant::now();

        while accumulator >= FIXED_DT && steps < MAX_PHYSICS_STEPS {
            let timings = system_manager.run_all(&mut world, FIXED_DT);
            if steps == 0 {
                system_timings = timings;
            }
            accumulator -= FIXED_DT;
            steps += 1;
        }

        physics_time_us = physics_start.elapsed().as_micros() as u64;

        let fps = fps_counter.tick();

        let collision_stats = system_manager
            .get_system::<CollisionSystem>()
            .map(|cs| cs.get_stats())
            .unwrap_or_default();

        render_system
            .render(&world, fps, physics_time_us, &system_timings, collision_stats)?;

        if fps_counter.frames == 0 {
            let sleeping_count = world
                .query::<SleepState>()
                .filter(|(_, s)| s.sleeping)
                .count();
            println!(
                "FPS: {:.1} | Physics: {} us | Steps: {} | Sleeping: {}/{}",
                fps, physics_time_us, steps, sleeping_count, BALL_COUNT
            );
        }
    }

    println!("Shutting down...");
    Ok(())
}
