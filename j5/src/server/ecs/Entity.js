class Entity {
  constructor(id, type) {
    this.id = id;
    this.type = type;
    this.components = {};
  }

  addComponent(component) {
    this.components[component.name] = component;
    return this;
  }

  getComponent(name) {
    return this.components[name];
  }

  hasComponent(name) {
    return !!this.components[name];
  }

  removeComponent(name) {
    delete this.components[name];
    return this;
  }
}

module.exports = Entity;
