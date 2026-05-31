import { WebSocket, WebSocketServer } from 'ws';
import { GameMessage, createMessage, MessageType } from './protocol';
import { EventEmitter } from 'events';

export interface PlayerConnection {
  sessionId: string;
  playerId: string;
  entityId: string;
  ws: WebSocket;
  lastPing: number;
}

export class GameServer extends EventEmitter {
  private wss: WebSocketServer;
  private connections: Map<string, PlayerConnection> = new Map();
  private entityToConnection: Map<string, string> = new Map();
  private port: number;

  constructor(port: number = 8080) {
    super();
    this.port = port;
    this.wss = new WebSocketServer({ port: this.port });
    this.setupEvents();
    console.log(`[GameServer] WebSocket server started on port ${port}`);
  }

  private setupEvents(): void {
    this.wss.on('connection', (ws: WebSocket, req: any) => {
      this.handleConnection(ws, req);
    });
  }

  private handleConnection(ws: WebSocket, req: any): void {
    const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
    const playerId = urlParams.get('playerId') || `player_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    console.log(`[GameServer] Client connected: ${playerId}, session: ${sessionId}`);

    const connection: PlayerConnection = {
      sessionId,
      playerId,
      entityId: '',
      ws,
      lastPing: Date.now()
    };

    this.connections.set(sessionId, connection);

    this.emit('player_connected', { sessionId, playerId, ws });

    this.send(ws, createMessage('connect', { sessionId, playerId }, sessionId));

    ws.on('message', (data: string) => {
      this.handleMessage(connection, data);
    });

    ws.on('close', () => {
      this.handleDisconnection(connection);
    });

    ws.on('error', (err: Error) => {
      console.error(`[GameServer] WebSocket error for ${playerId}:`, err);
      this.handleDisconnection(connection);
    });
  }

  private handleMessage(connection: PlayerConnection, data: string): void {
    try {
      const message: GameMessage = JSON.parse(data);
      message.sessionId = connection.sessionId;

      if (message.type === 'ping') {
        this.send(connection.ws, createMessage('pong', null, connection.sessionId));
        connection.lastPing = Date.now();
        return;
      }

      this.emit('message', { connection, message });
    } catch (err) {
      console.error(`[GameServer] Invalid message from ${connection.playerId}:`, err);
      this.sendError(connection.ws, 'Invalid message format', connection.sessionId);
    }
  }

  private handleDisconnection(connection: PlayerConnection): void {
    console.log(`[GameServer] Client disconnected: ${connection.playerId}`);
    this.emit('player_disconnected', { sessionId: connection.sessionId, playerId: connection.playerId, entityId: connection.entityId });
    this.connections.delete(connection.sessionId);
    if (connection.entityId) {
      this.entityToConnection.delete(connection.entityId);
    }
  }

  registerEntity(sessionId: string, entityId: string): void {
    const connection = this.connections.get(sessionId);
    if (connection) {
      connection.entityId = entityId;
      this.entityToConnection.set(entityId, sessionId);
    }
  }

  sendToEntity(entityId: string, message: GameMessage): void {
    const sessionId = this.entityToConnection.get(entityId);
    if (sessionId) {
      const connection = this.connections.get(sessionId);
      if (connection && connection.ws.readyState === WebSocket.OPEN) {
        this.send(connection.ws, message);
      }
    }
  }

  sendToSession(sessionId: string, message: GameMessage): void {
    const connection = this.connections.get(sessionId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      this.send(connection.ws, message);
    }
  }

  broadcast(message: GameMessage): void {
    for (const connection of this.connections.values()) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        this.send(connection.ws, message);
      }
    }
  }

  sendToEntities(entityIds: string[], message: GameMessage): void {
    for (const entityId of entityIds) {
      this.sendToEntity(entityId, message);
    }
  }

  private send(ws: WebSocket, message: GameMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, errorMessage: string, sessionId: string): void {
    this.send(ws, createMessage('error', { message: errorMessage }, sessionId));
  }

  getConnection(sessionId: string): PlayerConnection | undefined {
    return this.connections.get(sessionId);
  }

  getConnectionByEntity(entityId: string): PlayerConnection | undefined {
    const sessionId = this.entityToConnection.get(entityId);
    return sessionId ? this.connections.get(sessionId) : undefined;
  }

  getPlayerCount(): number {
    return this.connections.size;
  }

  shutdown(): void {
    this.wss.close();
    console.log('[GameServer] Server shut down');
  }
}
