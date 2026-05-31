import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import type { LogEntry, WebSocketMessage, AlertMessage } from '../../shared/types.js';
import { LogStore } from './logStore.js';

const BATCH_INTERVAL = 50;
const MAX_BATCH_SIZE = 200;

export class LogWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, Set<NodeJS.Timeout>>;
  private logStore: LogStore;
  private batchBuffer: Map<WebSocket, LogEntry[]>;
  private batchTimer: Map<WebSocket, NodeJS.Timeout | null>;
  private cleanupTimer: NodeJS.Timeout | null;

  constructor(server: HttpServer, logStore: LogStore) {
    this.logStore = logStore;
    this.clients = new Map();
    this.batchBuffer = new Map();
    this.batchTimer = new Map();
    this.cleanupTimer = null;

    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      clientTracking: false,
      perMessageDeflate: false,
      maxPayload: 1024 * 1024,
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    this.startCleanupTimer();
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      for (const [ws] of this.clients) {
        if (ws.readyState !== WebSocket.OPEN) {
          this.removeClient(ws);
        }
      }
    }, 5000);
  }

  private handleConnection(ws: WebSocket, req: any): void {
    const clientIp = req.socket.remoteAddress || 'unknown';
    console.log('New WebSocket connection from:', clientIp, 'Total clients:', this.clients.size + 1);

    this.clients.set(ws, new Set());
    this.batchBuffer.set(ws, []);
    this.batchTimer.set(ws, null);

    const { logs } = this.logStore.query({ limit: 200 });
    const historyMsg: WebSocketMessage = {
      type: 'history',
      data: logs.reverse(),
    };

    this.sendToClient(ws, JSON.stringify(historyMsg));

    ws.on('close', (code, reason) => {
      console.log('WebSocket closed. Code:', code, 'Reason:', reason.toString());
      this.removeClient(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket client error:', error.message);
      this.removeClient(ws);
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          this.sendToClient(ws, JSON.stringify({ type: 'pong' }));
        }
      } catch {
      }
    });
  }

  private removeClient(ws: WebSocket): void {
    const timer = this.batchTimer.get(ws);
    if (timer) {
      clearTimeout(timer);
    }
    this.batchTimer.delete(ws);
    this.batchBuffer.delete(ws);
    this.clients.delete(ws);

    try {
      ws.terminate();
    } catch {
    }

    console.log('Client removed. Remaining clients:', this.clients.size);
  }

  private sendToClient(ws: WebSocket, data: string): boolean {
    if (ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      ws.send(data, { binary: false }, (error) => {
        if (error) {
          this.removeClient(ws);
        }
      });
      return true;
    } catch (error) {
      this.removeClient(ws);
      return false;
    }
  }

  private flushBatch(ws: WebSocket): void {
    const buffer = this.batchBuffer.get(ws);
    if (!buffer || buffer.length === 0) {
      this.batchTimer.set(ws, null);
      return;
    }

    const logs = [...buffer];
    buffer.length = 0;
    this.batchTimer.set(ws, null);

    for (const log of logs) {
      const message: WebSocketMessage = {
        type: 'log',
        data: log,
      };
      const messageStr = JSON.stringify(message);
      if (!this.sendToClient(ws, messageStr)) {
        break;
      }
    }
  }

  broadcastLog(log: LogEntry): void {
    for (const [ws] of this.clients) {
      if (ws.readyState !== WebSocket.OPEN) {
        continue;
      }

      const buffer = this.batchBuffer.get(ws);
      if (!buffer) {
        continue;
      }

      buffer.push(log);

      if (buffer.length >= MAX_BATCH_SIZE) {
        this.flushBatch(ws);
      } else if (!this.batchTimer.get(ws)) {
        const timer = setTimeout(() => this.flushBatch(ws), BATCH_INTERVAL);
        this.batchTimer.set(ws, timer);
      }
    }
  }

  broadcastAlert(alert: AlertMessage): void {
    const message: WebSocketMessage = {
      type: 'alert',
      data: alert,
    };
    const messageStr = JSON.stringify(message);

    for (const [ws] of this.clients) {
      this.sendToClient(ws, messageStr);
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  close(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    for (const [ws, timers] of this.clients) {
      const batchTimer = this.batchTimer.get(ws);
      if (batchTimer) {
        clearTimeout(batchTimer);
      }
      timers.forEach((t) => clearTimeout(t));
      try {
        ws.terminate();
      } catch {
      }
    }

    this.clients.clear();
    this.batchBuffer.clear();
    this.batchTimer.clear();

    this.wss.close(() => {
      console.log('WebSocket server closed');
    });
  }
}
