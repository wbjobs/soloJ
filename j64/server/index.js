const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const { LifeEngine, patterns } = require('../core');

const PORT = process.env.PORT || 3000;
const GRID_WIDTH = 1000;
const GRID_HEIGHT = 1000;
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

const HEADER_SIZE = 1 + 4 + 4;

class GameServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.engine = null;
    this.isRunning = false;
    this.clients = new Set();
    this.lastFrameTime = 0;
    this.frameInterval = null;
  }

  async init() {
    this.engine = new LifeEngine(GRID_WIDTH, GRID_HEIGHT);
    await this.engine.init();
    this.engine.fillRandom(0.3);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../web')));
  }

  setupRoutes() {
    this.app.get('/api/config', (req, res) => {
      const patternInfo = {};
      for (const [name, data] of Object.entries(patterns)) {
        patternInfo[name] = {
          width: data[0].length,
          height: data.length
        };
      }
      res.json({
        width: GRID_WIDTH,
        height: GRID_HEIGHT,
        targetFps: TARGET_FPS,
        patterns: patternInfo
      });
    });

    this.app.post('/api/cell', (req, res) => {
      const { x, y, value } = req.body;
      if (typeof x === 'number' && typeof y === 'number' && typeof value === 'boolean') {
        this.engine.setCell(x, y, value);
        res.json({ success: true });
      } else {
        res.status(400).json({ error: 'Invalid parameters' });
      }
    });

    this.app.post('/api/cells', (req, res) => {
      const { cells } = req.body;
      if (Array.isArray(cells)) {
        for (const { x, y, value } of cells) {
          this.engine.setCell(x, y, value);
        }
        res.json({ success: true, count: cells.length });
      } else {
        res.status(400).json({ error: 'Invalid parameters' });
      }
    });

    this.app.post('/api/clear', (req, res) => {
      this.engine.clear();
      this.broadcastStateBinary();
      res.json({ success: true });
    });

    this.app.post('/api/random', (req, res) => {
      const density = req.body.density || 0.3;
      this.engine.fillRandom(density);
      this.broadcastStateBinary();
      res.json({ success: true });
    });

    this.app.post('/api/pattern', (req, res) => {
      const { name, x, y } = req.body;
      if (patterns[name]) {
        if (req.body.load) {
          this.stop();
          this.engine.loadPattern(name);
        } else {
          this.engine.placePattern(name, x || 0, y || 0);
        }
        this.broadcastStateBinary();
        res.json({ success: true });
      } else {
        res.status(400).json({ error: 'Pattern not found' });
      }
    });

    this.app.get('/api/history', (req, res) => {
      const range = this.engine.getHistoryRange();
      res.json(range);
    });

    this.app.get('/api/history/:gen', (req, res) => {
      const gen = parseInt(req.params.gen, 10);
      const snapshot = this.engine.getHistorySnapshot(gen);
      if (!snapshot) {
        return res.status(404).json({ error: 'Snapshot not found' });
      }
      res.setHeader('Content-Type', 'application/octet-stream');
      const buf = Buffer.from(snapshot.cells.buffer, snapshot.cells.byteOffset, snapshot.cells.length);
      res.end(buf);
    });

    this.app.post('/api/start', (req, res) => {
      this.start();
      res.json({ success: true, running: this.isRunning });
    });

    this.app.post('/api/stop', (req, res) => {
      this.stop();
      res.json({ success: true, running: this.isRunning });
    });

    this.app.post('/api/step', (req, res) => {
      const steps = req.body.steps || 1;
      this.step(steps);
      res.json({ success: true, steps });
    });

    this.app.get('/api/status', (req, res) => {
      res.json({
        running: this.isRunning,
        generation: this.engine.generation,
        fps: this.engine.fps,
        clients: this.clients.size
      });
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      console.log(`客户端已连接. 总连接数: ${this.clients.size}`);
      
      this.sendInitBinary(ws);

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleClientMessage(ws, msg);
        } catch (e) {
          console.error('解析消息失败:', e);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`客户端已断开. 总连接数: ${this.clients.size}`);
      });

      ws.on('error', (err) => {
        console.error('WebSocket 错误:', err);
        this.clients.delete(ws);
      });
    });
  }

  sendInitBinary(ws) {
    const state = this.engine.getState();
    const cellsLen = state.grid.cells.length;
    const buf = Buffer.alloc(HEADER_SIZE + cellsLen);
    
    buf.writeUInt8(0x01, 0);
    buf.writeUInt32BE(state.generation, 1);
    buf.writeUInt32BE(this.isRunning ? 1 : 0, 5);
    Buffer.from(state.grid.cells.buffer, state.grid.cells.byteOffset, cellsLen).copy(buf, HEADER_SIZE);

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(buf);
    }
  }

  handleClientMessage(ws, msg) {
    switch (msg.type) {
      case 'setCell':
        this.engine.setCell(msg.x, msg.y, msg.value);
        break;
      case 'setCells':
        if (Array.isArray(msg.cells)) {
          for (const { x, y, value } of msg.cells) {
            this.engine.setCell(x, y, value);
          }
        }
        break;
      case 'clear':
        this.engine.clear();
        this.broadcastStateBinary();
        break;
      case 'random':
        this.engine.fillRandom(msg.density || 0.3);
        this.broadcastStateBinary();
        break;
      case 'pattern':
        this.engine.placePattern(msg.name, msg.x, msg.y);
        this.broadcastStateBinary();
        break;
      case 'loadPattern':
        if (this.engine.loadPattern(msg.name)) {
          this.stop();
          this.broadcastStateBinary();
        }
        break;
      case 'history': {
        const snapshot = this.engine.getHistorySnapshot(msg.generation);
        if (snapshot) {
          const buf = Buffer.alloc(HEADER_SIZE + snapshot.cells.length);
          buf.writeUInt8(0x02, 0);
          buf.writeUInt32BE(snapshot.generation, 1);
          buf.writeUInt32BE(0, 5);
          Buffer.from(snapshot.cells.buffer, snapshot.cells.byteOffset, snapshot.cells.length).copy(buf, HEADER_SIZE);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(buf);
          }
        }
        break;
      }
      case 'start':
        this.start();
        break;
      case 'stop':
        this.stop();
        break;
      case 'step':
        this.step(msg.steps || 1);
        break;
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.runLoop();
    this.broadcastStatus();
  }

  stop() {
    this.isRunning = false;
    if (this.frameInterval) {
      clearTimeout(this.frameInterval);
      this.frameInterval = null;
    }
    this.broadcastStatus();
  }

  step(steps = 1) {
    let completed = 0;
    const doStep = () => {
      this.engine.evolve(() => {
        completed++;
        this.broadcastStateBinary();
        if (completed < steps) {
          doStep();
        }
      });
    };
    doStep();
  }

  runLoop() {
    if (!this.isRunning) return;

    const now = Date.now();
    const elapsed = now - this.lastFrameTime;

    if (elapsed >= FRAME_INTERVAL) {
      this.engine.evolve(() => {
        this.broadcastStateBinary();
        this.lastFrameTime = Date.now();
        this.frameInterval = setTimeout(() => this.runLoop(), 0);
      });
    } else {
      this.frameInterval = setTimeout(() => this.runLoop(), FRAME_INTERVAL - elapsed);
    }
  }

  broadcastStateBinary() {
    const state = this.engine.getState();
    const cellsLen = state.grid.cells.length;
    const buf = Buffer.alloc(HEADER_SIZE + cellsLen);
    
    buf.writeUInt8(0x01, 0);
    buf.writeUInt32BE(state.generation, 1);
    buf.writeUInt32BE(this.isRunning ? 1 : 0, 5);
    Buffer.from(state.grid.cells.buffer, state.grid.cells.byteOffset, cellsLen).copy(buf, HEADER_SIZE);

    const historyMeta = JSON.stringify({
      type: 'historyRange',
      oldest: this.engine.history.getOldestGeneration(),
      latest: this.engine.history.getLatestGeneration(),
      size: this.engine.history.getSize(),
      max: 100
    });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(buf);
        client.send(historyMeta);
      }
    }
  }

  broadcastStatus() {
    const msg = JSON.stringify({
      type: 'status',
      running: this.isRunning,
      generation: this.engine.generation,
      fps: this.engine.fps
    });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  async startServer() {
    await this.init();
    
    this.server.listen(PORT, () => {
      console.log('');
      console.log('========================================');
      console.log('    康威生命游戏服务器已启动');
      console.log('========================================');
      console.log(`服务器地址: http://localhost:${PORT}`);
      console.log(`WebSocket: ws://localhost:${PORT}`);
      console.log(`网格大小: ${GRID_WIDTH}x${GRID_HEIGHT}`);
      console.log(`目标 FPS: ${TARGET_FPS}`);
      console.log(`Worker 数量: ${this.engine.workerCount}`);
      console.log('========================================');
      console.log('');
    });
  }

  async shutdown() {
    this.stop();
    for (const client of this.clients) {
      client.close();
    }
    await this.engine.shutdown();
    this.server.close();
  }
}

const gameServer = new GameServer();

process.on('SIGINT', async () => {
  console.log('\n正在关闭服务器...');
  await gameServer.shutdown();
  process.exit(0);
});

gameServer.startServer().catch(console.error);

module.exports = GameServer;
