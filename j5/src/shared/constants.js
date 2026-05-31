const GRID_WIDTH = 10;
const GRID_HEIGHT = 10;
const SERVER_PORT = 3000;
const REFRESH_INTERVAL = 500;
const TICK_INTERVAL = 100;

const ENTITY_TYPES = {
  PLANT: 'plant',
  ZOMBIE: 'zombie'
};

const MESSAGE_TYPES = {
  JOIN: 'join',
  WATCH: 'watch',
  STATE: 'state',
  ACTION: 'action',
  ACTION_ACK: 'action_ack',
  ERROR: 'error',
  INFO: 'info',
  HEARTBEAT: 'heartbeat',
  SNAPSHOT: 'snapshot',
  ADMIN: 'admin'
};

const SYNC = {
  PREDICTION_ENABLED: true,
  MAX_PREDICTED_ACTIONS: 10,
  SNAPSHOT_INTERVAL: 1000
};

const PLANT_TYPES = {
  PEASHOOTER: {
    name: '豌豆射手',
    symbol: 'P',
    hp: 5,
    damage: 1,
    attackInterval: 1000,
    cost: 50
  },
  SUNFLOWER: {
    name: '向日葵',
    symbol: 'S',
    hp: 3,
    damage: 0,
    attackInterval: 0,
    cost: 25
  },
  WALLNUT: {
    name: '坚果墙',
    symbol: 'W',
    hp: 10,
    damage: 0,
    attackInterval: 0,
    cost: 40
  }
};

const ZOMBIE_TYPES = {
  NORMAL: {
    name: '普通僵尸',
    symbol: 'Z',
    hp: 3,
    damage: 1,
    speed: 1,
    attackInterval: 2000
  },
  CONEHEAD: {
    name: '路障僵尸',
    symbol: 'C',
    hp: 6,
    damage: 1,
    speed: 1,
    attackInterval: 2000
  },
  BUCKETHEAD: {
    name: '铁桶僵尸',
    symbol: 'B',
    hp: 10,
    damage: 1,
    speed: 1,
    attackInterval: 2000
  }
};

const CELL_STATE = {
  EMPTY: '-',
  PLANT: 'P',
  ZOMBIE: 'Z'
};

module.exports = {
  GRID_WIDTH,
  GRID_HEIGHT,
  SERVER_PORT,
  REFRESH_INTERVAL,
  TICK_INTERVAL,
  ENTITY_TYPES,
  MESSAGE_TYPES,
  SYNC,
  PLANT_TYPES,
  ZOMBIE_TYPES,
  CELL_STATE
};
