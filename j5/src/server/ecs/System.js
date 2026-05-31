class System {
  constructor(name) {
    this.name = name;
    this.world = null;
  }

  setWorld(world) {
    this.world = world;
  }

  update(deltaTime) {
    throw new Error('System.update() must be implemented');
  }
}

module.exports = System;
