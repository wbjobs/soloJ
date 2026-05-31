use std::num::NonZeroU32;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Entity {
    pub(crate) id: NonZeroU32,
    pub(crate) generation: u32,
}

impl Entity {
    fn new(index: u32, generation: u32) -> Self {
        Self {
            id: NonZeroU32::new(index + 1).unwrap(),
            generation,
        }
    }

    pub fn index(&self) -> usize {
        (self.id.get() - 1) as usize
    }

    pub fn generation(&self) -> u32 {
        self.generation
    }
}

pub struct EntityManager {
    next_index: u32,
    free_list: Vec<u32>,
    generations: Vec<u32>,
}

impl EntityManager {
    pub fn new() -> Self {
        Self {
            next_index: 0,
            free_list: Vec::new(),
            generations: Vec::new(),
        }
    }

    pub fn create(&mut self) -> Entity {
        if let Some(index) = self.free_list.pop() {
            let generation = self.generations[index as usize];
            Entity::new(index, generation)
        } else {
            let index = self.next_index;
            self.next_index += 1;
            self.generations.push(0);
            Entity::new(index, 0)
        }
    }

    pub fn destroy(&mut self, entity: Entity) {
        let index = entity.index() as u32;
        self.generations[index as usize] += 1;
        self.free_list.push(index);
    }

    pub fn is_alive(&self, entity: Entity) -> bool {
        let index = entity.index();
        index < self.generations.len() && self.generations[index] == entity.generation()
    }
}

impl Default for EntityManager {
    fn default() -> Self {
        Self::new()
    }
}
