const net = require('net');
const readline = require('readline');
const { SERVER_PORT, MESSAGE_TYPES, REFRESH_INTERVAL, PLANT_TYPES, SYNC, GRID_WIDTH, GRID_HEIGHT } = require('../shared/constants');
const Renderer = require('./Renderer');

class GameClient {
  constructor(options = {}) {
    this.host = options.host || 'localhost';
    this.port = options.port || SERVER_PORT;
    this.roomId = options.roomId || null;
    this.isWatcher = options.watch || false;
    this.simulatedLatency = options.latency || 0;

    this.socket = null;
    this.renderer = new Renderer(this.isWatcher);
    this.currentState = null;
    this.buffer = '';
    this.refreshInterval = null;
    this.connected = false;
    this.sequence = 0;
    this.pendingActions = new Map();
    this.serverTick = 0;
    this.lastRtt = 0;
  }

  connect() {
    console.log(`正在连接到服务器 ${this.host}:${this.port}...`);

    this.socket = net.createConnection({
      host: this.host,
      port: this.port
    }, () => {
      console.log('已连接到服务器!');
      this.connected = true;

      if (this.isWatcher && this.roomId) {
        this.sendWatch();
      } else {
        this.sendJoin();
      }

      this.setupInput();
      this.startRefreshLoop();
    });

    this.socket.on('data', (data) => {
      this.handleData(data);
    });

    this.socket.on('close', () => {
      console.log('\n与服务器的连接已断开');
      this.cleanup();
      process.exit(0);
    });

    this.socket.on('error', (err) => {
      console.error(`连接错误: ${err.message}`);
      this.cleanup();
      process.exit(1);
    });
  }

  handleData(data) {
    this.buffer += data.toString();

    const messages = this.buffer.split('\n');
    this.buffer = messages.pop() || '';

    for (const message of messages) {
      if (!message.trim()) continue;

      try {
        const parsed = JSON.parse(message);
        this.handleMessage(parsed);
      } catch (err) {
        console.error('解析消息失败:', err.message);
      }
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case MESSAGE_TYPES.STATE:
        this.currentState = message.state;
        this.validatePredictions(message.state);
        break;
      case MESSAGE_TYPES.ACTION_ACK:
        this.handleActionAck(message);
        break;
      case MESSAGE_TYPES.INFO:
        if (message.roomId && !this.roomId) {
          this.roomId = message.roomId;
        }
        if (message.message) {
          this.lastMessage = message.message;
        }
        break;
      case MESSAGE_TYPES.ERROR:
        console.error(`\n错误: ${message.message}`);
        break;
      default:
        break;
    }
  }

  handleActionAck(message) {
    const sequence = message.sequence;
    const pendingAction = this.pendingActions.get(sequence);

    if (pendingAction) {
      this.lastRtt = Date.now() - pendingAction.timestamp;
      this.renderer.setLatency(Math.round(this.lastRtt));

      if (message.success) {
        this.renderer.removePredictedPlant(sequence);
      } else {
        this.rollbackAction(sequence, message);
      }

      this.pendingActions.delete(sequence);
    }
  }

  validatePredictions(serverState) {
    if (this.pendingActions.size === 0) return;

    const pendingSequences = Array.from(this.pendingActions.keys());
    for (const sequence of pendingSequences) {
      const pending = this.pendingActions.get(sequence);
      if (!pending) continue;

      if (Date.now() - pending.timestamp > 5000) {
        console.log(`操作 #${sequence} 超时，回滚`);
        this.rollbackAction(sequence, { message: '操作超时' });
        this.pendingActions.delete(sequence);
      }
    }
  }

  rollbackAction(sequence, message) {
    const pendingAction = this.pendingActions.get(sequence);
    if (pendingAction) {
      console.log(`回滚操作 #${sequence}: ${message.message}`);
    }
    this.renderer.removePredictedPlant(sequence);
  }

  sendJoin() {
    this.sendMessage({
      type: MESSAGE_TYPES.JOIN,
      roomId: this.roomId
    });
  }

  sendWatch() {
    this.sendMessage({
      type: MESSAGE_TYPES.WATCH,
      roomId: this.roomId
    });
  }

  sendAction(action, data = {}) {
    const sequence = ++this.sequence;
    const timestamp = Date.now();

    if (SYNC.PREDICTION_ENABLED && action === 'place_plant' && !this.isWatcher) {
      this.predictPlantPlacement(sequence, data);
    }

    this.pendingActions.set(sequence, {
      action,
      data,
      timestamp
    });

    while (this.pendingActions.size > SYNC.MAX_PREDICTED_ACTIONS) {
      const oldestSequence = Math.min(...this.pendingActions.keys());
      this.pendingActions.delete(oldestSequence);
      this.renderer.removePredictedPlant(oldestSequence);
    }

    this.sendMessage({
      type: MESSAGE_TYPES.ACTION,
      action,
      sequence,
      timestamp,
      ...data
    });
  }

  predictPlantPlacement(sequence, data) {
    const { x, y, plantType } = data;
    const plantConfig = PLANT_TYPES[plantType];
    const currentSun = this.renderer.predictedSunPoints !== null 
      ? this.renderer.predictedSunPoints 
      : (this.currentState ? this.currentState.sunPoints : 100);

    if (!this.canPredict(x, y, plantType)) {
      return;
    }

    this.renderer.addPredictedPlant(
      sequence,
      x,
      y,
      plantType,
      currentSun - plantConfig.cost
    );
  }

  canPredict(x, y, plantType) {
    if (!this.currentState) return false;

    const plantConfig = PLANT_TYPES[plantType];
    if (!plantConfig) return false;

    const currentSun = this.renderer.predictedSunPoints !== null 
      ? this.renderer.predictedSunPoints 
      : this.currentState.sunPoints;

    if (currentSun < plantConfig.cost) return false;
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
    if (this.currentState.grid[y][x] !== '-') return false;

    for (const plant of this.renderer.predictedPlants.values()) {
      if (plant.x === x && plant.y === y) return false;
    }

    return true;
  }

  sendMessage(message) {
    if (!this.socket || !this.connected) return;

    const rawMessage = JSON.stringify(message) + '\n';

    if (this.simulatedLatency > 0) {
      setTimeout(() => {
        try {
          this.socket.write(rawMessage);
        } catch (err) {
          console.error('发送消息失败:', err.message);
        }
      }, this.simulatedLatency / 2);
    } else {
      try {
        this.socket.write(rawMessage);
      } catch (err) {
        console.error('发送消息失败:', err.message);
      }
    }
  }

  setupInput() {
    if (this.isWatcher) {
      return;
    }

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdin.on('keypress', (str, key) => {
      if (key.ctrl && key.name === 'c') {
        this.cleanup();
        process.exit(0);
      }

      if (this.isWatcher) return;

      switch (key.name) {
        case 'w':
        case 'up':
          this.renderer.moveCursor(0, -1);
          break;
        case 's':
        case 'down':
          this.renderer.moveCursor(0, 1);
          break;
        case 'a':
        case 'left':
          this.renderer.moveCursor(-1, 0);
          break;
        case 'd':
        case 'right':
          this.renderer.moveCursor(1, 0);
          break;
        case 'space':
          this.placePlant();
          break;
        case '1':
          this.renderer.selectPlant('PEASHOOTER');
          break;
        case '2':
          this.renderer.selectPlant('SUNFLOWER');
          break;
        case '3':
          this.renderer.selectPlant('WALLNUT');
          break;
        case 'escape':
          this.cleanup();
          process.exit(0);
          break;
      }
    });
  }

  placePlant() {
    const { cursorX, cursorY, selectedPlant } = this.renderer;

    this.sendAction('place_plant', {
      x: cursorX,
      y: cursorY,
      plantType: selectedPlant
    });
  }

  startRefreshLoop() {
    this.refreshInterval = setInterval(() => {
      if (this.currentState) {
        this.renderer.render(this.currentState);
      }
    }, REFRESH_INTERVAL);
  }

  cleanup() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    if (this.socket) {
      this.socket.destroy();
    }
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    host: 'localhost',
    port: SERVER_PORT,
    roomId: null,
    watch: false,
    latency: 0
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--host':
        options.host = args[++i] || 'localhost';
        break;
      case '--port':
        options.port = parseInt(args[++i]) || SERVER_PORT;
        break;
      case '--room':
        options.roomId = args[++i] || null;
        break;
      case '--watch':
        options.watch = true;
        options.roomId = args[++i] || null;
        break;
      case '--latency':
        options.latency = parseInt(args[++i]) || 0;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
植物大战僵尸 - 网络版客户端

用法:
  node src/client/index.js [options]

选项:
  --host <host>      服务器地址 (默认: localhost)
  --port <port>      服务器端口 (默认: ${SERVER_PORT})
  --room <roomId>    加入指定房间 (不指定则创建新房间)
  --watch <roomId>   观战指定房间
  --latency <ms>     模拟网络延迟 (用于测试，例如: --latency 200)

控制:
  WASD               移动光标
  空格               在光标位置放置植物
  1/2/3              切换植物类型 (豌豆射手/向日葵/坚果墙)
  ESC                退出游戏

示例:
  node src/client/index.js                    # 加入游戏 (创建新房间)
  node src/client/index.js --room ABC123      # 加入指定房间
  node src/client/index.js --watch ABC123     # 观战指定房间
  node src/client/index.js --latency 200      # 模拟 200ms 网络延迟
`);
}

const options = parseArgs();
const client = new GameClient(options);
client.connect();

process.on('SIGINT', () => {
  client.cleanup();
  process.exit(0);
});
