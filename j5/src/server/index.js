const net = require('net');
const { SERVER_PORT, TICK_INTERVAL, MESSAGE_TYPES, SYNC } = require('../shared/constants');
const RoomManager = require('./RoomManager');

class GameServer {
  constructor(port = SERVER_PORT) {
    this.port = port;
    this.roomManager = new RoomManager();
    this.clients = new Map();
    this.server = null;
    this.tickInterval = null;
  }

  start() {
    this.server = net.createServer((socket) => {
      this.handleConnection(socket);
    });

    this.server.listen(this.port, () => {
      console.log(`游戏服务器已启动，监听端口 ${this.port}`);
      console.log(`等待客户端连接...`);
    });

    this.tickInterval = setInterval(() => {
      this.gameTick();
    }, TICK_INTERVAL);
  }

  handleConnection(socket) {
    const clientId = this.generateClientId();

    console.log(`新客户端连接: ${clientId} (${socket.remoteAddress}:${socket.remotePort})`);

    this.clients.set(clientId, {
      socket,
      clientId,
      room: null,
      isWatcher: false,
      buffer: ''
    });

    socket.on('data', (data) => {
      this.handleData(clientId, data);
    });

    socket.on('close', () => {
      this.handleDisconnect(clientId);
    });

    socket.on('error', (err) => {
      console.error(`客户端 ${clientId} 错误: ${err.message}`);
      this.handleDisconnect(clientId);
    });
  }

  handleData(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.buffer += data.toString();

    const messages = client.buffer.split('\n');
    client.buffer = messages.pop() || '';

    for (const message of messages) {
      if (!message.trim()) continue;

      try {
        const parsed = JSON.parse(message);
        this.handleMessage(clientId, parsed);
      } catch (err) {
        this.sendToClient(clientId, {
          type: MESSAGE_TYPES.ERROR,
          message: '无效的消息格式'
        });
      }
    }
  }

  handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case MESSAGE_TYPES.JOIN:
        this.handleJoin(clientId, message);
        break;
      case MESSAGE_TYPES.WATCH:
        this.handleWatch(clientId, message);
        break;
      case MESSAGE_TYPES.ACTION:
        this.handleAction(clientId, message);
        break;
      case MESSAGE_TYPES.HEARTBEAT:
        break;
      case MESSAGE_TYPES.ADMIN:
        this.handleAdmin(clientId, message);
        break;
      default:
        this.sendToClient(clientId, {
          type: MESSAGE_TYPES.ERROR,
          message: `未知的消息类型: ${message.type}`
        });
    }
  }

  handleAdmin(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client.room) return;

    const room = client.room;

    if (message.command === 'end_game') {
      room.onZombieReachEnd(0, Math.floor(Math.random() * 10));
      this.broadcastState(room);
    }
  }

  handleJoin(clientId, message) {
    const client = this.clients.get(clientId);
    const roomId = message.roomId;

    const room = this.roomManager.getOrCreateRoom(roomId);

    client.room = room;
    client.isWatcher = false;

    room.addPlayer(clientId, client);

    console.log(`客户端 ${clientId} 加入房间 ${room.roomId}`);

    this.sendToClient(clientId, {
      type: MESSAGE_TYPES.INFO,
      message: `已加入房间 ${room.roomId}`,
      roomId: room.roomId,
      isPlayer: true
    });

    this.broadcastState(room);
  }

  handleWatch(clientId, message) {
    const client = this.clients.get(clientId);
    const roomId = message.roomId;

    if (!roomId) {
      this.sendToClient(clientId, {
        type: MESSAGE_TYPES.ERROR,
        message: '观战需要指定房间ID'
      });
      return;
    }

    const room = this.roomManager.getRoom(roomId);

    if (!room) {
      this.sendToClient(clientId, {
        type: MESSAGE_TYPES.ERROR,
        message: `房间 ${roomId} 不存在`
      });
      return;
    }

    client.room = room;
    client.isWatcher = true;

    room.addWatcher(clientId, client);

    console.log(`客户端 ${clientId} 观战房间 ${room.roomId}`);

    this.sendToClient(clientId, {
      type: MESSAGE_TYPES.INFO,
      message: `正在观战房间 ${room.roomId}`,
      roomId: room.roomId,
      isPlayer: false
    });

    this.sendState(clientId, room);
  }

  handleAction(clientId, message) {
    const client = this.clients.get(clientId);
    const sequence = message.sequence;
    const timestamp = message.timestamp;

    if (!client.room) {
      this.sendToClient(clientId, {
        type: MESSAGE_TYPES.ERROR,
        message: '请先加入房间'
      });
      return;
    }

    if (client.isWatcher) {
      this.sendToClient(clientId, {
        type: MESSAGE_TYPES.ERROR,
        message: '观战者无法执行操作'
      });
      return;
    }

    const room = client.room;
    let result = { success: false, message: '未知操作' };

    if (message.action === 'place_plant') {
      result = room.placePlant(message.x, message.y, message.plantType);
      result.x = message.x;
      result.y = message.y;
      result.plantType = message.plantType;
    }

    this.sendToClient(clientId, {
      type: MESSAGE_TYPES.ACTION_ACK,
      sequence: sequence,
      timestamp: timestamp,
      serverTime: Date.now(),
      action: message.action,
      success: result.success,
      message: result.message,
      x: result.x,
      y: result.y,
      plantType: result.plantType
    });

    this.broadcastState(room);
  }

  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (client.room) {
      client.room.removePlayer(clientId);
      console.log(`客户端 ${clientId} 断开连接，离开房间 ${client.room.roomId}`);
    }

    this.clients.delete(clientId);
  }

  gameTick() {
    const rooms = this.roomManager.getAllRooms();

    for (const room of rooms) {
      const prevStatus = room.status;
      room.update(TICK_INTERVAL);

      if (room.status === 'gameover' && prevStatus === 'playing') {
        room.saveRecording();
      }

      if (room.status === 'gameover' || room.status === 'waiting') {
        if (room.getAllClients().length > 0) {
          this.broadcastState(room);
        }
      }
    }
  }

  broadcastState(room) {
    const state = room.getState();

    const clients = room.getAllClients();
    for (const client of clients) {
      this.sendToClient(client.clientId, {
        type: MESSAGE_TYPES.STATE,
        state
      });
    }
  }

  sendState(clientId, room) {
    const state = room.getState();
    this.sendToClient(clientId, {
      type: MESSAGE_TYPES.STATE,
      state
    });
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || !client.socket) return;

    try {
      client.socket.write(JSON.stringify(message) + '\n');
    } catch (err) {
      console.error(`发送消息给客户端 ${clientId} 失败: ${err.message}`);
    }
  }

  generateClientId() {
    return Math.random().toString(36).substring(2, 10);
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
    console.log('服务器已停止');
  }
}

const server = new GameServer();
server.start();

process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  server.stop();
  process.exit(0);
});
