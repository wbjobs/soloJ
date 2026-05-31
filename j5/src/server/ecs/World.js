const Entity = require('./Entity');

class World {
  constructor() {
    this.entities = new Map();
    this.systems = [];
    this.nextEntityId = 1;
  }

  createEntity(type) {
    const id = this.nextEntityId++;
    const entity = new Entity(id, type);
    this.entities.set(id, entity);
    return entity;
  }

  removeEntity(id) {
    this.entities.delete(id);
  }

  getEntity(id) {
    return this.entities.get(id);
  }

  getAllEntities() {
    return Array.from(this.entities.values());
  }

  getEntitiesByType(type) {
    return this.getAllEntities().filter(e => e.type === type);
  }

  getEntitiesWithComponent(componentName) {
    return this.getAllEntities().filter(e => e.hasComponent(componentName));
  }

  addSystem(system) {
    system.setWorld(this);
    this.systems.push(system);
    return this;
  }

  getSystems() {
    return this.systems;
  }

  update(deltaTime) {
    for (const system of this.systems) {
      system.update(deltaTime);
    }
  }

  clear() {
    this.entities.clear();
    this.nextEntityId = 1;
  }
}

module.exports = World;
