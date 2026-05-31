const World = require('./ecs/World');
const MovementSystem = require('./systems/MovementSystem');
const AttackSystem = require('./systems/AttackSystem');
const ZombieSpawnSystem = require('./systems/ZombieSpawnSystem');
const Recorder = require('./Recorder');
const { GRID_WIDTH, GRID_HEIGHT, PLANT_TYPES, ZOMBIE_TYPES, SYNC } = require('../shared/constants');
const {
  PositionComponent,
  HealthComponent,
  MovementComponent,
  AttackComponent,
  PlantComponent,
  ZombieComponent,
  RenderComponent
} = require('./ecs/components');

class Room {
  constructor(roomId) {
    this.roomId = roomId;
    this.world = new World();
    this.players = new Map();
    this.watchers = new Map();
    this.status = 'waiting';
    this.score = 0;
    this.wave = 0;
    this.sunPoints = 100;
    this.tick = 0;
    this.lastSnapshotTime = 0;
    this.actionHistory = [];
    this.recorder = new Recorder(roomId);
    this.recordInterval = null;

    this.world.addSystem(new MovementSystem());
    this.world.addSystem(new AttackSystem());
    this.world.addSystem(new ZombieSpawnSystem(5000));

    this.world.onZombieReachEnd = (x, y) => {
      this.onZombieReachEnd(x, y);
    };
  }

  addPlayer(clientId, client) {
    this.players.set(clientId, client);
    if (this.players.size === 1) {
      this.status = 'playing';
      this.startRecording();
    }
  }

  startRecording() {
    this.recordInterval = setInterval(() => {
      if (this.status === 'playing') {
        this.recorder.recordTick(this.tick, this.getState());
      }
    }, 100);
  }

  stopRecording() {
    if (this.recordInterval) {
      clearInterval(this.recordInterval);
      this.recordInterval = null;
    }
    this.recorder.finish();
    return this.recorder.saveToFile();
  }

  removePlayer(clientId) {
    this.players.delete(clientId);
    this.watchers.delete(clientId);
  }

  addWatcher(clientId, client) {
    this.watchers.set(clientId, client);
  }

  placePlant(x, y, plantType) {
    const type = PLANT_TYPES[plantType.toUpperCase()];
    if (!type) return { success: false, message: '未知植物类型' };

    if (this.sunPoints < type.cost) {
      return { success: false, message: '阳光点数不足' };
    }

    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
      return { success: false, message: '位置超出范围' };
    }

    if (this.isOccupied(x, y)) {
      return { success: false, message: '该位置已被占用' };
    }

    const plant = this.world.createEntity('plant');
    plant.addComponent(new PositionComponent(x, y));
    plant.addComponent(new HealthComponent(type.hp));
    plant.addComponent(new AttackComponent(type.damage, type.attackInterval));
    plant.addComponent(new PlantComponent(plantType.toUpperCase()));
    plant.addComponent(new RenderComponent(type.symbol));

    this.sunPoints -= type.cost;
    this.score += 10;

    this.recorder.recordEvent('plant_placed', {
      x, y,
      plantType: plantType.toUpperCase(),
      cost: type.cost,
      sunPoints: this.sunPoints,
      tick: this.tick
    });

    return { success: true, message: '植物放置成功' };
  }

  isOccupied(x, y) {
    const entities = this.world.getAllEntities();
    for (const entity of entities) {
      if (!entity.hasComponent('position')) continue;
      const pos = entity.getComponent('position');
      if (pos.x === x && pos.y === y) {
        return true;
      }
    }
    return false;
  }

  update(deltaTime) {
    if (this.status !== 'playing') return;
    this.tick++;
    this.world.update(deltaTime);
  }

  getState() {
    const grid = Array(GRID_HEIGHT).fill(null).map(() =>
      Array(GRID_WIDTH).fill('-')
    );

    const entities = this.world.getAllEntities();
    for (const entity of entities) {
      if (!entity.hasComponent('position') || !entity.hasComponent('render')) continue;
      const pos = entity.getComponent('position');
      const render = entity.getComponent('render');
      if (pos.y >= 0 && pos.y < GRID_HEIGHT && pos.x >= 0 && pos.x < GRID_WIDTH) {
        grid[pos.y][pos.x] = render.symbol;
      }
    }

    return {
      roomId: this.roomId,
      status: this.status,
      score: this.score,
      sunPoints: this.sunPoints,
      wave: this.wave,
      tick: this.tick,
      timestamp: Date.now(),
      grid: grid
    };
  }

  getSnapshot() {
    return {
      ...this.getState(),
      actionHistory: this.actionHistory.slice(-50)
    };
  }

  onZombieReachEnd(x, y) {
    if (this.status === 'gameover') return;
    
    this.status = 'gameover';
    this.recorder.recordEvent('zombie_breakthrough', {
      x, y,
      tick: this.tick
    });
    
    this.saveRecording();
  }

  saveRecording() {
    const filepath = this.stopRecording();
    console.log(`[${this.roomId}] 游戏录像已保存: ${filepath}`);
    return filepath;
  }

  getPlayerCount() {
    return this.players.size;
  }

  getWatcherCount() {
    return this.watchers.size;
  }

  getAllClients() {
    return [...this.players.values(), ...this.watchers.values()];
  }
}

module.exports = Room;
