import { Server, WebSocket } from 'ws';
import { IncomingMessage, Server as HttpServer } from 'http';
import { wsAuthMiddleware, JwtPayload } from '../auth';
import { documentManager, DocumentManager } from '../crdt';
import { OperationLogRepository, operationLogRepository } from '../db/repositories/OperationLogRepository';

enum SyncState {
  Idle = 'idle',
  Syncing = 'syncing',
  Ready = 'ready',
}

interface DocSyncState {
  state: SyncState;
  pendingUpdates: Array<{ data: string; sourceClientId: string }>;
}

interface ClientConnection {
  ws: WebSocket;
  user: JwtPayload;
  subscribedDocs: Set<string>;
  docSyncStates: Map<string, DocSyncState>;
}

interface WsMessage {
  type: string;
  docId: string;
  data?: string;
  stateVector?: string;
}

export class CollabWebSocketServer {
  private wss: Server;
  private clients: Map<string, ClientConnection> = new Map();
  private docManager: DocumentManager;
  private opLogRepo: OperationLogRepository;

  constructor(
    server: HttpServer,
    docManager: DocumentManager = documentManager,
    opLogRepo: OperationLogRepository = operationLogRepository
  ) {
    this.wss = new Server({ noServer: true });
    this.docManager = docManager;
    this.opLogRepo = opLogRepo;
    this.setupServer(server);
  }

  private setupServer(httpServer: HttpServer): void {
    httpServer.on('upgrade', (request: IncomingMessage, socket, head) => {
      this.handleUpgrade(request, socket, head);
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    this.docManager.globalUpdateHandler = this.handleDocumentUpdate.bind(this);
  }

  private handleUpgrade(request: IncomingMessage, socket: any, head: Buffer): void {
    const token = this.extractTokenFromUrl(request.url || '');
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const user = wsAuthMiddleware(token);
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    (request as any).user = user;
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit('connection', ws, request);
    });
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const user = (request as any).user as JwtPayload;
    const clientId = this.generateClientId();

    const client: ClientConnection = {
      ws,
      user,
      subscribedDocs: new Set<string>(),
      docSyncStates: new Map<string, DocSyncState>(),
    };

    this.clients.set(clientId, client);

    console.log(`Client connected: ${clientId}, user: ${user.userId}`);

    ws.on('message', (data) => {
      this.handleMessage(clientId, client, data.toString());
    });

    ws.on('close', () => {
      this.handleClose(clientId, client);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
    });
  }

  private handleMessage(clientId: string, client: ClientConnection, messageStr: string): void {
    try {
      const message: WsMessage = JSON.parse(messageStr);

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, client, message);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(client, message);
          break;
        case 'update':
          this.handleUpdate(clientId, client, message);
          break;
        case 'sync-step-1':
          this.handleSyncStep1(clientId, client, message);
          break;
        case 'sync-step-2':
          this.handleSyncStep2(clientId, client, message);
          break;
        default:
          this.sendError(client.ws, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.sendError(client.ws, 'Invalid message format');
    }
  }

  private handleSubscribe(clientId: string, client: ClientConnection, message: WsMessage): void {
    const { docId } = message;
    if (!this.docManager.hasDocument(docId)) {
      this.sendError(client.ws, `Document ${docId} not found`);
      return;
    }

    client.subscribedDocs.add(docId);
    client.docSyncStates.set(docId, {
      state: SyncState.Syncing,
      pendingUpdates: [],
    });

    console.log(`Client ${clientId} subscribed to doc ${docId}, starting sync`);

    this.initiateServerSync(clientId, client, docId);
  }

  private initiateServerSync(clientId: string, client: ClientConnection, docId: string): void {
    try {
      const serverSv = this.docManager.encodeStateVectorToBase64(docId);
      this.sendMessage(client.ws, {
        type: 'sync-step-1',
        docId,
        stateVector: serverSv,
      });
    } catch (error) {
      console.error('Error initiating server sync:', error);
      this.sendError(client.ws, `Sync initiation failed: ${error}`);
    }
  }

  private handleUnsubscribe(client: ClientConnection, message: WsMessage): void {
    const { docId } = message;
    client.subscribedDocs.delete(docId);
    client.docSyncStates.delete(docId);
  }

  private handleUpdate(clientId: string, client: ClientConnection, message: WsMessage): void {
    const { docId, data } = message;
    if (!data || !client.subscribedDocs.has(docId)) {
      return;
    }

    const syncState = client.docSyncStates.get(docId);
    if (syncState && syncState.state === SyncState.Syncing) {
      syncState.pendingUpdates.push({ data, sourceClientId: clientId });
      return;
    }

    this.applyClientUpdate(docId, data, clientId, client);
  }

  private applyClientUpdate(docId: string, data: string, sourceClientId: string, client: ClientConnection): void {
    try {
      const update = this.docManager.decodeBase64ToUpdate(data);
      this.docManager.applyUpdate(docId, update, sourceClientId);
      this.opLogRepo.logOperation(
        docId,
        update,
        client.user.userId,
        sourceClientId
      ).catch((error) => {
        console.error('Failed to log operation:', error);
      });
    } catch (error) {
      console.error('Error applying update:', error);
      this.sendError(client.ws, `Failed to apply update: ${error}`);
    }
  }

  private handleSyncStep1(clientId: string, client: ClientConnection, message: WsMessage): void {
    const { docId, stateVector } = message;
    if (!client.subscribedDocs.has(docId)) {
      return;
    }

    try {
      const targetSv = stateVector
        ? Uint8Array.from(Buffer.from(stateVector, 'base64'))
        : undefined;

      const update = this.docManager.getStateAsUpdate(docId, targetSv);
      const serverSv = this.docManager.encodeStateVectorToBase64(docId);

      this.sendMessage(client.ws, {
        type: 'sync-step-2',
        docId,
        data: Buffer.from(update).toString('base64'),
        stateVector: serverSv,
      });
    } catch (error) {
      console.error('Error in sync-step-1:', error);
      this.sendError(client.ws, `Sync failed: ${error}`);
    }
  }

  private handleSyncStep2(clientId: string, client: ClientConnection, message: WsMessage): void {
    const { docId, data } = message;
    if (!data || !client.subscribedDocs.has(docId)) {
      return;
    }

    try {
      const update = this.docManager.decodeBase64ToUpdate(data);
      this.docManager.applyUpdate(docId, update, clientId);
      this.opLogRepo.logOperation(
        docId,
        update,
        client.user.userId,
        clientId
      ).catch((error) => {
        console.error('Failed to log sync operation:', error);
      });

      const syncState = client.docSyncStates.get(docId);
      if (syncState && syncState.state === SyncState.Syncing) {
        syncState.state = SyncState.Ready;

        this.sendMessage(client.ws, {
          type: 'sync-complete',
          docId,
        });

        this.flushPendingUpdates(clientId, client, docId, syncState);
      }
    } catch (error) {
      console.error('Error in sync-step-2:', error);
      this.sendError(client.ws, `Sync failed: ${error}`);
    }
  }

  private flushPendingUpdates(clientId: string, client: ClientConnection, docId: string, syncState: DocSyncState): void {
    if (syncState.pendingUpdates.length === 0) return;

    console.log(`Flushing ${syncState.pendingUpdates.length} pending updates for client ${clientId}, doc ${docId}`);

    for (const pending of syncState.pendingUpdates) {
      this.applyClientUpdate(docId, pending.data, pending.sourceClientId, client);
    }

    syncState.pendingUpdates = [];
  }

  private handleDocumentUpdate(update: Uint8Array, docId: string, sourceClientId: string | null): void {
    const message = {
      type: 'update',
      docId,
      data: Buffer.from(update).toString('base64'),
    };

    const messageStr = JSON.stringify(message);

    this.clients.forEach((client, clientId) => {
      if (clientId === sourceClientId) return;
      if (!client.subscribedDocs.has(docId)) return;
      if (client.ws.readyState !== WebSocket.OPEN) return;

      const syncState = client.docSyncStates.get(docId);
      if (syncState && syncState.state === SyncState.Syncing) return;

      client.ws.send(messageStr);
    });
  }

  private handleClose(clientId: string, client: ClientConnection): void {
    console.log(`Client disconnected: ${clientId}`);
    client.subscribedDocs.forEach((docId) => {
      client.subscribedDocs.delete(docId);
    });
    client.docSyncStates.clear();
    this.clients.delete(clientId);
  }

  private sendMessage(ws: WebSocket, payload: Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  private sendError(ws: WebSocket, errorMsg: string): void {
    this.sendMessage(ws, {
      type: 'error',
      message: errorMsg,
    });
  }

  private extractTokenFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url, 'http://localhost');
      return urlObj.searchParams.get('token');
    } catch {
      return null;
    }
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  getConnectedClients(): number {
    return this.clients.size;
  }

  close(): void {
    this.wss.close();
  }
}
