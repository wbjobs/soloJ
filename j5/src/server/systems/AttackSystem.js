const System = require('../ecs/System');

class AttackSystem extends System {
  constructor() {
    super('attack');
  }

  update(deltaTime) {
    const now = Date.now();
    const plants = this.world.getEntitiesByType('plant');
    const zombies = this.world.getEntitiesByType('zombie');

    for (const plant of plants) {
      if (!plant.hasComponent('attack') || !plant.hasComponent('position')) continue;

      const attack = plant.getComponent('attack');
      const position = plant.getComponent('position');

      if (attack.damage <= 0) continue;
      if (now - attack.lastAttackTime < attack.attackInterval) continue;

      const target = this.findTargetInRow(position.x, position.y, zombies);

      if (target) {
        const targetHealth = target.getComponent('health');
        if (targetHealth) {
          targetHealth.takeDamage(attack.damage);
          attack.lastAttackTime = now;

          if (targetHealth.isDead()) {
            this.world.removeEntity(target.id);
          }
        }
      }
    }

    for (const zombie of zombies) {
      if (!zombie.hasComponent('attack') || !zombie.hasComponent('position')) continue;

      const attack = zombie.getComponent('attack');
      const position = zombie.getComponent('position');

      if (now - attack.lastAttackTime < attack.attackInterval) continue;

      const target = this.findAdjacentPlant(position.x - 1, position.y, plants);

      if (target) {
        const targetHealth = target.getComponent('health');
        if (targetHealth) {
          targetHealth.takeDamage(attack.damage);
          attack.lastAttackTime = now;

          if (targetHealth.isDead()) {
            this.world.removeEntity(target.id);
          }
        }
      }
    }
  }

  findTargetInRow(x, y, zombies) {
    for (const zombie of zombies) {
      if (!zombie.hasComponent('position')) continue;
      const pos = zombie.getComponent('position');
      if (pos.y === y && pos.x > x) {
        return zombie;
      }
    }
    return null;
  }

  findAdjacentPlant(x, y, plants) {
    for (const plant of plants) {
      if (!plant.hasComponent('position')) continue;
      const pos = plant.getComponent('position');
      if (pos.x === x && pos.y === y) {
        return plant;
      }
    }
    return null;
  }
}

module.exports = AttackSystem;
