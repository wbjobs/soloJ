use crate::ecs::World;

pub trait System: std::any::Any {
    fn run(&mut self, world: &mut World, delta_time: f32);
    fn name(&self) -> &'static str {
        std::any::type_name::<Self>()
    }
    fn as_any(&self) -> &dyn std::any::Any;
    fn as_any_mut(&mut self) -> &mut dyn std::any::Any;
}

pub struct SystemManager {
    systems: Vec<Box<dyn System>>,
}

impl SystemManager {
    pub fn new() -> Self {
        Self {
            systems: Vec::new(),
        }
    }

    pub fn add<S: System + 'static>(&mut self, system: S) {
        self.systems.push(Box::new(system));
    }

    pub fn run_all(&mut self, world: &mut World, delta_time: f32) -> Vec<(&'static str, std::time::Duration)> {
        let mut timings = Vec::new();
        for system in &mut self.systems {
            let start = std::time::Instant::now();
            system.run(world, delta_time);
            let elapsed = start.elapsed();
            timings.push((system.name(), elapsed));
        }
        timings
    }

    pub fn get_system<S: System + 'static>(&self) -> Option<&S> {
        for system in &self.systems {
            if let Some(s) = system.as_any().downcast_ref::<S>() {
                return Some(s);
            }
        }
        None
    }
}

impl Default for SystemManager {
    fn default() -> Self {
        Self::new()
    }
}
