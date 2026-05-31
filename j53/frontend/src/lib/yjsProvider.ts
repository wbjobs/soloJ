import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Awareness } from 'y-protocols/awareness';
import { PhoenixSyncProvider } from './phoenixProvider';

export interface YjsConnectionState {
  isConnected: boolean;
  isOnline: boolean;
  isSynced: boolean;
}

function generateStableClientId(): string {
  let id = localStorage.getItem('yjs_client_id');
  if (!id) {
    id = 'user-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
    localStorage.setItem('yjs_client_id', id);
  }
  return id;
}

function getClientColor(clientId: string): string {
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) {
    hash = ((hash << 5) - hash) + clientId.charCodeAt(i);
    hash = hash & hash;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

function getClientName(clientId: string): string {
  const shortId = clientId.substring(5, 11).toUpperCase();
  return `User ${shortId}`;
}

export class YjsProvider {
  public doc: Y.Doc;
  public phoenixProvider: PhoenixSyncProvider | null = null;
  public indexeddbProvider: IndexeddbPersistence | null = null;
  public awareness: Awareness;
  public clientId: string;
  public userColor: string;
  public userName: string;

  private docId: string;
  private websocketUrl: string;
  private state: YjsConnectionState = {
    isConnected: false,
    isOnline: true,
    isSynced: false
  };
  private stateChangeListeners: Set<(state: YjsConnectionState) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 50;
  private reconnectDelay = 1000;
  private networkListener: (() => void) | null = null;
  private unbinders: Array<() => void> = [];
  private ytext: Y.Text | null = null;

  constructor(docId: string, websocketUrl: string = 'ws://localhost:4000/socket/websocket') {
    this.docId = docId;
    this.websocketUrl = websocketUrl;
    this.clientId = generateStableClientId();
    this.userColor = getClientColor(this.clientId);
    this.userName = getClientName(this.clientId);

    this.doc = new Y.Doc();
    this.doc.clientID = this._stringToUint32(this.clientId);

    this.awareness = new Awareness(this.doc);

    this.awareness.setLocalStateField('user', {
      name: this.userName,
      color: this.userColor,
      colorLight: this.userColor
    });
  }

  private _stringToUint32(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) >>> 0;
  }

  async connect(): Promise<void> {
    this.setupOfflineStorage();
    this.setupOnlineSync();
    this.setupNetworkMonitoring();
  }

  private setupOfflineStorage(): void {
    this.indexeddbProvider = new IndexeddbPersistence(this.docId, this.doc);

    const syncedHandler = () => {
      console.log(`[Yjs] Document loaded from IndexedDB: ${this.docId}`);
      if (!this.state.isConnected) {
        this.updateState({ isSynced: true });
      }
    };

    this.indexeddbProvider.on('synced', syncedHandler);

    this.unbinders.push(() => {
      this.indexeddbProvider?.off('synced', syncedHandler);
    });
  }

  private setupOnlineSync(): void {
    this.phoenixProvider = new PhoenixSyncProvider({
      websocketUrl: this.websocketUrl,
      docId: this.docId,
      doc: this.doc,
      awareness: this.awareness
    });

    const statusHandler = (event: { status: string }) => {
      const isConnected = event.status === 'connected';
      console.log(`[Yjs] PhoenixProvider status: ${event.status}`);

      if (isConnected) {
        this.reconnectAttempts = 0;
        this.updateState({ isConnected: true, isOnline: true });
      } else {
        this.updateState({ isConnected: false });
        if (event.status === 'disconnected') {
          this.scheduleReconnect();
        }
      }
    };

    const syncHandler = (isSynced: boolean) => {
      console.log(`[Yjs] Sync status: ${isSynced}`);
      this.updateState({ isSynced });
    };

    const connectionCloseHandler = () => {
      console.log(`[Yjs] PhoenixProvider connection closed`);
      this.updateState({ isConnected: false });
      this.scheduleReconnect();
    };

    const connectionErrorHandler = (error: Error) => {
      console.error(`[Yjs] PhoenixProvider connection error:`, error);
      this.updateState({ isConnected: false, isOnline: false });
    };

    const unbindStatus = this.phoenixProvider.on('status', statusHandler);
    const unbindSync = this.phoenixProvider.on('sync', syncHandler);
    const unbindClose = this.phoenixProvider.on('connection-close', connectionCloseHandler);
    const unbindError = this.phoenixProvider.on('connection-error', connectionErrorHandler);

    this.unbinders.push(unbindStatus, unbindSync, unbindClose, unbindError);

    this.phoenixProvider.connect();
  }

  private setupNetworkMonitoring(): void {
    if (typeof window !== 'undefined') {
      this.updateState({ isOnline: navigator.onLine });

      this.networkListener = () => {
        const isOnline = navigator.onLine;
        console.log(`[Network] Status changed: ${isOnline ? 'online' : 'offline'}`);
        this.updateState({ isOnline });

        if (isOnline) {
          this.attemptReconnect();
        }
      };

      window.addEventListener('online', this.networkListener);
      window.addEventListener('offline', this.networkListener);

      this.unbinders.push(() => {
        window.removeEventListener('online', this.networkListener!);
        window.removeEventListener('offline', this.networkListener!);
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`[Yjs] Max reconnection attempts reached (${this.maxReconnectAttempts})`);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), 30000);

    console.log(`[Yjs] Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      this.attemptReconnect();
    }, delay);
  }

  private attemptReconnect(): void {
    if (this.state.isConnected) {
      return;
    }

    if (this.phoenixProvider && !this.state.isConnected) {
      console.log(`[Yjs] Attempting to reconnect...`);
      this.phoenixProvider.connect();
    }
  }

  private updateState(newState: Partial<YjsConnectionState>): void {
    this.state = { ...this.state, ...newState };
    this.notifyStateChange();
  }

  private notifyStateChange(): void {
    this.stateChangeListeners.forEach(listener => listener(this.state));
  }

  public onStateChange(listener: (state: YjsConnectionState) => void): () => void {
    this.stateChangeListeners.add(listener);
    return () => {
      this.stateChangeListeners.delete(listener);
    };
  }

  public getState(): YjsConnectionState {
    return { ...this.state };
  }

  public getText(name: string = 'default'): Y.Text {
    if (!this.ytext || this.ytext._item === null) {
      this.ytext = this.doc.getText(name);
    }
    return this.ytext;
  }

  public getAwareness(): Awareness {
    return this.awareness;
  }

  public getUserInfo(): { name: string; color: string } {
    return {
      name: this.userName,
      color: this.userColor
    };
  }

  public disconnect(): void {
    this.unbinders.forEach(unbind => {
      try { unbind(); } catch (e) {}
    });
    this.unbinders = [];

    if (this.phoenixProvider) {
      try {
        this.phoenixProvider.destroy();
      } catch (e) {}
      this.phoenixProvider = null;
    }

    if (this.indexeddbProvider) {
      try {
        this.indexeddbProvider.destroy();
      } catch (e) {}
      this.indexeddbProvider = null;
    }

    if (this.awareness) {
      try {
        this.awareness.destroy();
      } catch (e) {}
    }

    this.doc.destroy();
    this.ytext = null;

    this.updateState({ isConnected: false, isSynced: false });
    console.log(`[Yjs] Provider disconnected for doc: ${this.docId}`);
  }

  public forceSync(): void {
    if (this.phoenixProvider) {
      console.log(`[Yjs] Forcing synchronization`);
      this.phoenixProvider.disconnect();
      setTimeout(() => {
        this.phoenixProvider?.connect();
      }, 200);
    }
  }
}
