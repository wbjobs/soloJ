const System = require('../ecs/System');
const { GRID_WIDTH, GRID_HEIGHT, ZOMBIE_TYPES } = require('../../shared/constants');
const {
  PositionComponent,
  HealthComponent,
  MovementComponent,
  AttackComponent,
  ZombieComponent,
  RenderComponent
} = require('../ecs/components');

class ZombieSpawnSystem extends System {
  constructor(spawnInterval = 5000) {
    super('zombieSpawn');
    this.spawnInterval = spawnInterval;
    this.lastSpawnTime = 0;
  }

  update(deltaTime) {
    const now = Date.now();

    if (now - this.lastSpawnTime < this.spawnInterval) return;

    this.spawnZombie();
    this.lastSpawnTime = now;
  }

  spawnZombie() {
    const zombieTypes = Object.keys(ZOMBIE_TYPES);
    const typeKey = zombieTypes[Math.floor(Math.random() * zombieTypes.length)];
    const zombieType = ZOMBIE_TYPES[typeKey];

    const row = Math.floor(Math.random() * GRID_HEIGHT);

    const zombie = this.world.createEntity('zombie');
    zombie.addComponent(new PositionComponent(GRID_WIDTH - 1, row));
    zombie.addComponent(new HealthComponent(zombieType.hp));
    zombie.addComponent(new MovementComponent(zombieType.speed));
    zombie.addComponent(new AttackComponent(zombieType.damage, zombieType.attackInterval));
    zombie.addComponent(new ZombieComponent(typeKey));
    zombie.addComponent(new RenderComponent(zombieType.symbol));

    return zombie;
  }
}

module.exports = ZombieSpawnSystem;
