use crate::ecs::{Component, ComponentStorage, Entity, EntityManager};

pub struct World {
    entity_manager: EntityManager,
    component_storage: ComponentStorage,
}

impl World {
    pub fn new() -> Self {
        Self {
            entity_manager: EntityManager::new(),
            component_storage: ComponentStorage::new(),
        }
    }

    pub fn create_entity(&mut self) -> Entity {
        self.entity_manager.create()
    }

    pub fn destroy_entity(&mut self, entity: Entity) {
        self.entity_manager.destroy(entity);
    }

    pub fn is_alive(&self, entity: Entity) -> bool {
        self.entity_manager.is_alive(entity)
    }

    pub fn add_component<T: Component>(&mut self, entity: Entity, component: T) {
        self.component_storage.insert(entity, component);
    }

    pub fn remove_component<T: Component>(&mut self, entity: Entity) {
        self.component_storage.remove::<T>(entity);
    }

    pub fn get_component<T: Component>(&self, entity: Entity) -> Option<&T> {
        self.component_storage.get::<T>(entity)
    }

    pub fn get_component_mut<T: Component>(&mut self, entity: Entity) -> Option<&mut T> {
        self.component_storage.get_mut::<T>(entity)
    }

    pub fn has_component<T: Component>(&self, entity: Entity) -> bool {
        self.component_storage.has::<T>(entity)
    }

    pub fn entities_with<T: Component>(&self) -> impl Iterator<Item = Entity> + '_ {
        self.component_storage.entities_with::<T>()
    }

    pub fn query<T: Component>(&self) -> impl Iterator<Item = (Entity, &T)> + '_ {
        self.component_storage.iter::<T>()
    }

    pub fn query_mut<T: Component>(&mut self) -> impl Iterator<Item = (Entity, &mut T)> + '_ {
        self.component_storage.iter_mut::<T>()
    }

    pub fn query2<T: Component, U: Component>(
        &self,
    ) -> impl Iterator<Item = (Entity, &T, &U)> + '_ {
        self.component_storage
            .iter::<T>()
            .filter_map(move |(e, t)| {
                self.component_storage
                    .get::<U>(e)
                    .map(|u| (e, t, u))
            })
    }

    pub fn query2_mut<T: Component, U: Component>(
        &mut self,
    ) -> Vec<(Entity, *mut T, *mut U)> {
        let entities: Vec<Entity> = self.component_storage.entities_with::<T>().collect();
        let mut results = Vec::new();
        for e in entities {
            if !self.component_storage.has::<U>(e) {
                continue;
            }
            let t_ptr = self.component_storage.get_mut::<T>(e).unwrap() as *mut T;
            let u_ptr = self.component_storage.get_mut::<U>(e).unwrap() as *mut U;
            results.push((e, t_ptr, u_ptr));
        }
        results
    }

    pub fn query3<T: Component, U: Component, V: Component>(
        &self,
    ) -> impl Iterator<Item = (Entity, &T, &U, &V)> + '_ {
        self.component_storage
            .iter::<T>()
            .filter_map(move |(e, t)| {
                let u = self.component_storage.get::<U>(e)?;
                let v = self.component_storage.get::<V>(e)?;
                Some((e, t, u, v))
            })
    }

    pub fn query3_mut<T: Component, U: Component, V: Component>(
        &mut self,
    ) -> Vec<(Entity, *mut T, *mut U, *mut V)> {
        let entities: Vec<Entity> = self.component_storage.entities_with::<T>().collect();
        let mut results = Vec::new();
        for e in entities {
            if !self.component_storage.has::<U>(e) || !self.component_storage.has::<V>(e) {
                continue;
            }
            let t_ptr = self.component_storage.get_mut::<T>(e).unwrap() as *mut T;
            let u_ptr = self.component_storage.get_mut::<U>(e).unwrap() as *mut U;
            let v_ptr = self.component_storage.get_mut::<V>(e).unwrap() as *mut V;
            results.push((e, t_ptr, u_ptr, v_ptr));
        }
        results
    }

    pub fn query4_mut<T: Component, U: Component, V: Component, W: Component>(
        &mut self,
    ) -> Vec<(Entity, *mut T, *mut U, *mut V, *mut W)> {
        let entities: Vec<Entity> = self.component_storage.entities_with::<T>().collect();
        let mut results = Vec::new();
        for e in entities {
            if !self.component_storage.has::<U>(e)
                || !self.component_storage.has::<V>(e)
                || !self.component_storage.has::<W>(e)
            {
                continue;
            }
            let t_ptr = self.component_storage.get_mut::<T>(e).unwrap() as *mut T;
            let u_ptr = self.component_storage.get_mut::<U>(e).unwrap() as *mut U;
            let v_ptr = self.component_storage.get_mut::<V>(e).unwrap() as *mut V;
            let w_ptr = self.component_storage.get_mut::<W>(e).unwrap() as *mut W;
            results.push((e, t_ptr, u_ptr, v_ptr, w_ptr));
        }
        results
    }

    pub fn component_storage(&self) -> &ComponentStorage {
        &self.component_storage
    }

    pub fn component_storage_mut(&mut self) -> &mut ComponentStorage {
        &mut self.component_storage
    }
}

impl Default for World {
    fn default() -> Self {
        Self::new()
    }
}
