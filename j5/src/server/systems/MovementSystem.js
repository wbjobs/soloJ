const System = require('../ecs/System');
const { GRID_WIDTH, GRID_HEIGHT, ZOMBIE_TYPES } = require('../../shared/constants');

class MovementSystem extends System {
  constructor() {
    super('movement');
  }

  update(deltaTime) {
    const now = Date.now();
    const zombies = this.world.getEntitiesByType('zombie');

    for (const zombie of zombies) {
      if (!zombie.hasComponent('movement') || !zombie.hasComponent('position')) continue;

      const movement = zombie.getComponent('movement');
      const position = zombie.getComponent('position');

      if (now - movement.lastMoveTime < 2000 / movement.speed) continue;

      const newX = position.x - 1;

      if (newX < 0) {
        this.world.removeEntity(zombie.id);
        if (this.world.onZombieReachEnd) {
          this.world.onZombieReachEnd(position.x, position.y);
        }
        continue;
      }

      const blocked = this.isBlocked(newX, position.y, zombie.id);
      if (blocked) {
        continue;
      }

      position.x = newX;
      movement.lastMoveTime = now;
    }
  }

  isBlocked(x, y, excludeId) {
    const entities = this.world.getAllEntities();
    for (const entity of entities) {
      if (entity.id === excludeId) continue;
      if (!entity.hasComponent('position')) continue;

      const pos = entity.getComponent('position');
      if (pos.x === x && pos.y === y) {
        if (entity.type === 'plant') {
          return true;
        }
      }
    }
    return false;
  }
}

module.exports = MovementSystem;
