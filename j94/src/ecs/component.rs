use std::any::{Any, TypeId};
use std::collections::HashMap;

use crate::ecs::Entity;

pub trait Component: Any + Send + Sync {}

impl<T: Any + Send + Sync> Component for T {}

struct ComponentVec {
    data: Vec<Option<Box<dyn Any + Send + Sync>>>,
}

impl ComponentVec {
    fn new() -> Self {
        Self { data: Vec::new() }
    }

    fn ensure_capacity(&mut self, index: usize) {
        if index >= self.data.len() {
            self.data.resize_with(index + 1, || None);
        }
    }

    fn insert<T: Component>(&mut self, entity: Entity, component: T) {
        let index = entity.index();
        self.ensure_capacity(index);
        self.data[index] = Some(Box::new(component));
    }

    fn get<T: Component>(&self, entity: Entity) -> Option<&T> {
        let index = entity.index();
        if index >= self.data.len() {
            return None;
        }
        self.data[index]
            .as_ref()
            .and_then(|b| b.downcast_ref::<T>())
    }

    fn get_mut<T: Component>(&mut self, entity: Entity) -> Option<&mut T> {
        let index = entity.index();
        if index >= self.data.len() {
            return None;
        }
        self.data[index]
            .as_mut()
            .and_then(|b| b.downcast_mut::<T>())
    }

    fn remove(&mut self, entity: Entity) {
        let index = entity.index();
        if index < self.data.len() {
            self.data[index] = None;
        }
    }

    fn has(&self, entity: Entity) -> bool {
        let index = entity.index();
        index < self.data.len() && self.data[index].is_some()
    }
}

pub struct ComponentStorage {
    components: HashMap<TypeId, ComponentVec>,
}

impl ComponentStorage {
    pub fn new() -> Self {
        Self {
            components: HashMap::new(),
        }
    }

    pub fn insert<T: Component>(&mut self, entity: Entity, component: T) {
        let type_id = TypeId::of::<T>();
        self.components
            .entry(type_id)
            .or_insert_with(ComponentVec::new)
            .insert(entity, component);
    }

    pub fn get<T: Component>(&self, entity: Entity) -> Option<&T> {
        let type_id = TypeId::of::<T>();
        self.components
            .get(&type_id)
            .and_then(|vec| vec.get::<T>(entity))
    }

    pub fn get_mut<T: Component>(&mut self, entity: Entity) -> Option<&mut T> {
        let type_id = TypeId::of::<T>();
        self.components
            .get_mut(&type_id)
            .and_then(|vec| vec.get_mut::<T>(entity))
    }

    pub fn remove<T: Component>(&mut self, entity: Entity) {
        let type_id = TypeId::of::<T>();
        if let Some(vec) = self.components.get_mut(&type_id) {
            vec.remove(entity);
        }
    }

    pub fn has<T: Component>(&self, entity: Entity) -> bool {
        let type_id = TypeId::of::<T>();
        self.components
            .get(&type_id)
            .map(|vec| vec.has(entity))
            .unwrap_or(false)
    }

    pub fn entities_with<T: Component>(&self) -> impl Iterator<Item = Entity> + '_ {
        let type_id = TypeId::of::<T>();
        self.components
            .get(&type_id)
            .map(|vec| {
                vec.data
                    .iter()
                    .enumerate()
                    .filter_map(|(index, opt)| {
                        if opt.is_some() {
                            Some(Entity {
                                id: std::num::NonZeroU32::new((index + 1) as u32).unwrap(),
                                generation: 0,
                            })
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<_>>()
                    .into_iter()
            })
            .into_iter()
            .flatten()
    }

    pub fn iter<T: Component>(&self) -> impl Iterator<Item = (Entity, &T)> + '_ {
        let type_id = TypeId::of::<T>();
        self.components
            .get(&type_id)
            .map(move |vec| {
                vec.data
                    .iter()
                    .enumerate()
                    .filter_map(move |(index, opt)| {
                        opt.as_ref().and_then(|b| {
                            b.downcast_ref::<T>().map(|c| {
                                (
                                    Entity {
                                        id: std::num::NonZeroU32::new((index + 1) as u32).unwrap(),
                                        generation: 0,
                                    },
                                    c,
                                )
                            })
                        })
                    })
                    .collect::<Vec<_>>()
                    .into_iter()
            })
            .into_iter()
            .flatten()
    }

    pub fn iter_mut<T: Component>(&mut self) -> impl Iterator<Item = (Entity, &mut T)> + '_ {
        let type_id = TypeId::of::<T>();
        self.components
            .get_mut(&type_id)
            .map(move |vec| {
                vec.data
                    .iter_mut()
                    .enumerate()
                    .filter_map(move |(index, opt)| {
                        opt.as_mut().and_then(|b| {
                            b.downcast_mut::<T>().map(|c| {
                                (
                                    Entity {
                                        id: std::num::NonZeroU32::new((index + 1) as u32).unwrap(),
                                        generation: 0,
                                    },
                                    c,
                                )
                            })
                        })
                    })
                    .collect::<Vec<_>>()
                    .into_iter()
            })
            .into_iter()
            .flatten()
    }
}

impl Default for ComponentStorage {
    fn default() -> Self {
        Self::new()
    }
}
