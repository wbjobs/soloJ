import { WebSocketServer } from 'ws';

class WebSocketManager {
  constructor() {
    this.clients = new Map();
    this.wss = null;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = parseInt(process.env.WS_HEARTBEAT_INTERVAL) || 30000;
    this.messageQueues = new Map();
    this.isShuttingDown = false;
    this.maxClientsPerTask = parseInt(process.env.WS_MAX_CLIENTS_PER_TASK) || 10;
    this.taskClientCount = new Map();
  }

  init(server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws',
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024
      }
    });
    
    this.startHeartbeat();
    
    this.wss.on('connection', (ws, request) => {
      const clientId = this.generateClientId(request);
      
      ws.clientId = clientId;
      ws.isAlive = true;
      ws.lastPing = Date.now();
      ws.lastPong = Date.now();
      ws.taskId = null;
      ws.messageQueue = [];
      ws.isProcessingQueue = false;
      
      this.clients.set(clientId, ws);
      this.messageQueues.set(clientId, []);
      
      console.log(`[WS] Client connected: ${clientId}. Total: ${this.clients.size}`);
      
      this.sendToClient(clientId, {
        type: 'connected',
        clientId,
        timestamp: Date.now()
      });
      
      ws.on('pong', () => {
        ws.isAlive = true;
        ws.lastPong = Date.now();
      });
      
      ws.on('close', (code, reason) => {
        this.handleClientDisconnect(clientId, ws, code, reason);
      });
      
      ws.on('error', (error) => {
        console.error(`[WS] Error for client ${clientId}:`, error.message);
        this.handleClientDisconnect(clientId, ws, 1011, error.message);
      });
      
      ws.on('message', (message) => {
        this.handleClientMessage(clientId, ws, message);
      });
    });
    
    this.wss.on('error', (error) => {
      console.error('[WS] Server error:', error);
    });
    
    process.on('SIGINT', () => this.gracefulShutdown());
  }

  generateClientId(request) {
    const ip = request.socket.remoteAddress || 'unknown';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${ip}_${timestamp}_${random}`;
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((ws, clientId) => {
        if (!ws.isAlive) {
          console.log(`[WS] Client ${clientId} missed heartbeat, terminating`);
          this.handleClientDisconnect(clientId, ws, 1001, 'Heartbeat timeout');
          return;
        }
        
        ws.isAlive = false;
        try {
          ws.ping();
          ws.lastPing = Date.now();
        } catch (e) {
          console.error(`[WS] Failed to ping client ${clientId}:`, e.message);
          this.handleClientDisconnect(clientId, ws, 1011, 'Ping failed');
        }
      });
    }, this.heartbeatTimeout);
  }

  handleClientMessage(clientId, ws, message) {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, ws, data.taskId);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, ws);
          break;
        case 'pong':
          ws.isAlive = true;
          ws.lastPong = Date.now();
          break;
        case 'get_status':
          this.sendToClient(clientId, {
            type: 'status',
            clientId,
            taskId: ws.taskId,
            connected: true,
            timestamp: Date.now()
          });
          break;
        default:
          console.log(`[WS] Unknown message type from ${clientId}:`, data.type);
      }
    } catch (e) {
      console.error(`[WS] Failed to parse message from ${clientId}:`, e.message);
      this.sendToClient(clientId, {
        type: 'error',
        error: 'Invalid message format',
        timestamp: Date.now()
      });
    }
  }

  handleSubscribe(clientId, ws, taskId) {
    if (!taskId) {
      this.sendToClient(clientId, {
        type: 'error',
        error: 'taskId is required',
        timestamp: Date.now()
      });
      return;
    }
    
    const currentCount = this.taskClientCount.get(taskId) || 0;
    if (currentCount >= this.maxClientsPerTask) {
      this.sendToClient(clientId, {
        type: 'error',
        error: 'Too many clients subscribed to this task',
        timestamp: Date.now()
      });
      return;
    }
    
    if (ws.taskId) {
      this.taskClientCount.set(ws.taskId, (this.taskClientCount.get(ws.taskId) || 1) - 1);
    }
    
    ws.taskId = taskId;
    this.taskClientCount.set(taskId, currentCount + 1);
    
    console.log(`[WS] Client ${clientId} subscribed to task ${taskId}. Task clients: ${currentCount + 1}`);
    
    this.sendToClient(clientId, {
      type: 'subscribed',
      taskId,
      timestamp: Date.now()
    });
    
    this.flushMessageQueue(taskId);
  }

  handleUnsubscribe(clientId, ws) {
    const taskId = ws.taskId;
    if (taskId) {
      const count = (this.taskClientCount.get(taskId) || 1) - 1;
      this.taskClientCount.set(taskId, Math.max(0, count));
      console.log(`[WS] Client ${clientId} unsubscribed from task ${taskId}. Task clients: ${count}`);
    }
    
    ws.taskId = null;
    
    this.sendToClient(clientId, {
      type: 'unsubscribed',
      timestamp: Date.now()
    });
  }

  handleClientDisconnect(clientId, ws, code, reason) {
    if (!this.clients.has(clientId)) return;
    
    const taskId = ws.taskId;
    if (taskId) {
      const count = (this.taskClientCount.get(taskId) || 1) - 1;
      this.taskClientCount.set(taskId, Math.max(0, count));
    }
    
    try {
      if (ws.readyState !== ws.CLOSED) {
        ws.terminate();
      }
    } catch (e) {
      console.error(`[WS] Error terminating client ${clientId}:`, e.message);
    }
    
    this.clients.delete(clientId);
    this.messageQueues.delete(clientId);
    
    console.log(`[WS] Client disconnected: ${clientId} (code: ${code}, reason: ${reason}). Total: ${this.clients.size}`);
  }

  queueMessage(taskId, message) {
    const queueKey = `task_${taskId}`;
    if (!this.messageQueues.has(queueKey)) {
      this.messageQueues.set(queueKey, []);
    }
    
    const queue = this.messageQueues.get(queueKey);
    queue.push({
      message,
      timestamp: Date.now(),
      attempts: 0
    });
    
    while (queue.length > 100) {
      queue.shift();
    }
    
    setImmediate(() => this.flushMessageQueue(taskId));
  }

  flushMessageQueue(taskId) {
    const queueKey = `task_${taskId}`;
    const queue = this.messageQueues.get(queueKey) || [];
    
    if (queue.length === 0) return;
    
    const taskClients = [];
    this.clients.forEach((ws) => {
      if (ws.taskId === taskId && ws.readyState === ws.OPEN) {
        taskClients.push(ws);
      }
    });
    
    if (taskClients.length === 0) return;
    
    const itemsToProcess = [...queue];
    queue.length = 0;
    
    for (const item of itemsToProcess) {
      const data = JSON.stringify(item.message);
      
      for (const ws of taskClients) {
        try {
          if (ws.readyState === ws.OPEN) {
            ws.send(data, (err) => {
              if (err) {
                console.error(`[WS] Failed to send message to ${ws.clientId}:`, err.message);
                if (item.attempts < 3) {
                  item.attempts++;
                  queue.unshift(item);
                }
              }
            });
          }
        } catch (e) {
          console.error(`[WS] Exception sending to ${ws.clientId}:`, e.message);
          if (item.attempts < 3) {
            item.attempts++;
            queue.unshift(item);
          }
        }
      }
    }
  }

  sendToClient(clientId, message) {
    const ws = this.clients.get(clientId);
    if (!ws) {
      console.warn(`[WS] Client ${clientId} not found for direct send`);
      return false;
    }
    
    if (ws.readyState !== ws.OPEN) {
      console.warn(`[WS] Client ${clientId} not ready (state: ${ws.readyState})`);
      return false;
    }
    
    try {
      const data = JSON.stringify(message);
      ws.send(data);
      return true;
    } catch (e) {
      console.error(`[WS] Failed to send to client ${clientId}:`, e.message);
      return false;
    }
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    let successCount = 0;
    
    this.clients.forEach((ws, clientId) => {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(data);
          successCount++;
        } catch (e) {
          console.error(`[WS] Broadcast failed for ${clientId}:`, e.message);
        }
      }
    });
    
    return successCount;
  }

  sendToTask(taskId, message) {
    const enhancedMessage = {
      ...message,
      _taskId: taskId,
      _sentAt: Date.now()
    };
    
    this.queueMessage(taskId, enhancedMessage);
  }

  sendProgress(taskId, progress, status, message) {
    this.sendToTask(taskId, {
      type: 'progress',
      taskId,
      progress,
      status,
      message,
      timestamp: Date.now()
    });
  }

  sendCompletion(taskId, result) {
    const message = {
      type: 'completed',
      taskId,
      result,
      timestamp: Date.now()
    };
    this.sendToTask(taskId, message);
    
    setTimeout(() => {
      this.clearTaskQueue(taskId);
    }, 60000);
  }

  sendError(taskId, error) {
    const message = {
      type: 'error',
      taskId,
      error,
      timestamp: Date.now()
    };
    this.sendToTask(taskId, message);
    
    setTimeout(() => {
      this.clearTaskQueue(taskId);
    }, 60000);
  }

  clearTaskQueue(taskId) {
    const queueKey = `task_${taskId}`;
    this.messageQueues.delete(queueKey);
    console.log(`[WS] Cleared message queue for task ${taskId}`);
  }

  getStats() {
    return {
      totalClients: this.clients.size,
      taskSubscriptions: Object.fromEntries(this.taskClientCount),
      pendingQueues: this.messageQueues.size,
      uptime: process.uptime()
    };
  }

  gracefulShutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    console.log('[WS] Graceful shutdown initiated');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.broadcast({
      type: 'shutdown',
      message: 'Server shutting down',
      timestamp: Date.now()
    });
    
    setTimeout(() => {
      if (this.wss) {
        this.wss.close(() => {
          console.log('[WS] Server closed');
        });
      }
    }, 1000);
  }
}

export default new WebSocketManager();
