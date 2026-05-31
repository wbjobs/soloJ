import type { WebSocketMessage } from '../types';

type MessageHandler = (message: WebSocketMessage) => void;

interface QueuedMessage {
  data: any;
  timestamp: number;
  priority: number;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private initialReconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  
  private subscribedTaskIds: Set<string> = new Set();
  private messageQueue: QueuedMessage[] = [];
  private isConnected = false;
  private lastMessageTime = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatInterval = 15000;
  private connectionTimeout = 45000;
  
  private missedPings = 0;
  private maxMissedPings = 3;
  private clientId: string | null = null;

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected');
      return;
    }

    if (this.reconnectAttempts === 0) {
      console.log('[WS] Initializing connection...');
    } else {
      console.log(`[WS] Reconnecting... (Attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      this.ws = new WebSocket(wsUrl);
    } catch (e) {
      console.error('[WS] Failed to create WebSocket:', e);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[WS] Connected successfully');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.missedPings = 0;
      this.lastMessageTime = Date.now();
      
      this.startHeartbeat();
      this.flushMessageQueue();
      
      this.subscribedTaskIds.forEach((taskId) => {
        this.subscribeInternal(taskId);
      });
      
      this.emit('connected', { type: 'connected', taskId: '', timestamp: Date.now() } as any);
    };

    this.ws.onmessage = (event) => {
      this.lastMessageTime = Date.now();
      this.missedPings = 0;
      
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        if (message.type === 'connected') {
          this.clientId = (message as any).clientId;
          console.log('[WS] Assigned client ID:', this.clientId);
        }
        
        if (message.type === 'subscribed') {
          console.log('[WS] Subscribed to task:', (message as any).taskId);
        }
        
        this.emit(message.type, message);
      } catch (e) {
        console.error('[WS] Failed to parse message:', e, 'Raw data:', event.data);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WS] Connection error:', error);
      this.emit('error', { type: 'error', taskId: '', error: 'Connection error', timestamp: Date.now() } as any);
    };

    this.ws.onclose = (event) => {
      console.log(`[WS] Connection closed (code: ${event.code}, reason: ${event.reason}, wasClean: ${event.wasClean})`);
      this.isConnected = false;
      this.stopHeartbeat();
      
      if (!event.wasClean || event.code !== 1000) {
        this.scheduleReconnect();
      }
      
      this.emit('disconnected', { type: 'disconnected', taskId: '', timestamp: Date.now() } as any);
    };
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      
      const now = Date.now();
      const timeSinceLastMessage = now - this.lastMessageTime;
      
      if (timeSinceLastMessage > this.connectionTimeout) {
        console.log('[WS] Connection timeout, reconnecting...');
        this.ws.close(1008, 'Timeout');
        return;
      }
      
      this.missedPings++;
      if (this.missedPings >= this.maxMissedPings) {
        console.log('[WS] Too many missed pings, reconnecting...');
        this.ws.close(1008, 'Missed too many pings');
        return;
      }
      
      try {
        this.ws.send(JSON.stringify({ type: 'get_status' }));
      } catch (e) {
        console.error('[WS] Failed to send heartbeat:', e);
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnection attempts reached');
      this.emit('max_reconnect_attempts', { type: 'max_reconnect_attempts', taskId: '', timestamp: Date.now() } as any);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.initialReconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    
    const jitter = Math.random() * 1000;
    const totalDelay = delay + jitter;
    
    console.log(`[WS] Scheduling reconnection in ${totalDelay.toFixed(0)}ms...`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, totalDelay);
  }

  private subscribeInternal(taskId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queueMessage({ type: 'subscribe', taskId }, Date.now(), 10);
      return;
    }

    try {
      this.ws.send(JSON.stringify({ type: 'subscribe', taskId }));
      console.log(`[WS] Subscribing to task: ${taskId}`);
    } catch (e) {
      console.error('[WS] Failed to subscribe:', e);
      this.queueMessage({ type: 'subscribe', taskId }, Date.now(), 10);
    }
  }

  subscribe(taskId: string): void {
    if (!taskId) {
      console.warn('[WS] Cannot subscribe to empty taskId');
      return;
    }
    
    this.subscribedTaskIds.add(taskId);
    this.subscribeInternal(taskId);
  }

  unsubscribe(taskId: string): void {
    this.subscribedTaskIds.delete(taskId);
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'unsubscribe', taskId }));
        console.log(`[WS] Unsubscribed from task: ${taskId}`);
      } catch (e) {
        console.error('[WS] Failed to unsubscribe:', e);
      }
    }
  }

  private queueMessage(data: any, timestamp: number, priority: number = 0): void {
    this.messageQueue.push({ data, timestamp, priority });
    this.messageQueue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);
    
    while (this.messageQueue.length > 1000) {
      this.messageQueue.shift();
    }
    
    if (this.isConnected) {
      setImmediate(() => this.flushMessageQueue());
    }
  }

  private flushMessageQueue(): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const messagesToSend = [...this.messageQueue];
    this.messageQueue = [];
    
    let sentCount = 0;
    for (const msg of messagesToSend) {
      try {
        this.ws.send(JSON.stringify(msg.data));
        sentCount++;
      } catch (e) {
        console.error('[WS] Failed to flush message:', e);
        this.messageQueue.push(msg);
      }
    }
    
    if (sentCount > 0) {
      console.log(`[WS] Flushed ${sentCount} queued messages`);
    }
  }

  on(event: string, handler: MessageHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: MessageHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: string, message: WebSocketMessage): void {
    this.handlers.get(event)?.forEach((handler) => {
      try {
        handler(message);
      } catch (e) {
        console.error(`[WS] Error in handler for event '${event}':`, e);
      }
    });
    
    if (event !== 'progress' && event !== 'connected' && event !== 'disconnected') {
      console.log(`[WS] Emitted event '${event}'`, message);
    }
  }

  getStatus(): {
    connected: boolean;
    subscribedTasks: string[];
    reconnectAttempts: number;
    clientId: string | null;
    queueSize: number;
  } {
    return {
      connected: this.isConnected,
      subscribedTasks: Array.from(this.subscribedTaskIds),
      reconnectAttempts: this.reconnectAttempts,
      clientId: this.clientId,
      queueSize: this.messageQueue.length
    };
  }

  waitForConnection(timeout: number = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, timeout);

      const handleConnect = () => {
        clearTimeout(timeoutId);
        this.off('connected', handleConnect);
        resolve();
      };

      this.on('connected', handleConnect);
    });
  }

  disconnect(): void {
    console.log('[WS] Disconnecting...');
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    this.subscribedTaskIds.clear();
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.isConnected = false;
    this.clientId = null;
    
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Client initiated disconnect');
      }
      this.ws = null;
    }
  }
}

export default new WebSocketService();
