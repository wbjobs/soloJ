import * as Y from 'yjs';
import { Socket, Channel } from 'phoenix';
import { createEncoder, toUint8Array, writeVarUint, writeVarUint8Array } from 'lib0/encoding';
import { createDecoder, readVarUint, readVarUint8Array } from 'lib0/decoding';
import { Awareness, removeAwarenessStates, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';
import { encodeSyncMessage, readSyncMessage, writeSyncStep1, writeSyncStep2, writeUpdate } from 'y-protocols/sync';
import type { YjsConnectionState } from './yjsProvider';

const messageYjsSyncStep1 = 0;
const messageYjsSyncStep2 = 1;
const messageYjsUpdate = 2;
const messageYjsAwareness = 3;
const messageYjsSyncDone = 4;

function uint8ArrayToBase64(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array));
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

export interface PhoenixSyncProviderOptions {
  websocketUrl: string;
  docId: string;
  doc: Y.Doc;
  awareness: Awareness;
}

export class PhoenixSyncProvider {
  public awareness: Awareness;
  public doc: Y.Doc;
  public socket: Socket | null = null;
  public channel: Channel | null = null;
  private websocketUrl: string;
  private roomName: string;
  private docId: string;
  private shouldConnect = false;
  private wsconnected = false;
  private _synced = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 50;
  private reconnectDelay = 1000;
  private messageQueue: Uint8Array[] = [];
  private _updateHandler: (update: Uint8Array, origin: any) => void;
  private _awarenessUpdateHandler: ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => void;
  private _awarenessChangeHandler: (changes: { added: number[]; updated: number[]; removed: number[] }) => void;
  private statusListeners: Set<(status: { status: string }) => void> = new Set();
  private syncListeners: Set<(isSynced: boolean) => void> = new Set();
  private connectionCloseListeners: Set<() => void> = new Set();
  private connectionErrorListeners: Set<(error: Error) => void> = new Set();
  private unbinders: Array<() => void> = [];

  constructor(options: PhoenixSyncProviderOptions) {
    this.doc = options.doc;
    this.docId = options.docId;
    this.websocketUrl = options.websocketUrl;
    this.awareness = options.awareness;
    this.roomName = `yjs:${this.docId}`;

    this._updateHandler = (update: Uint8Array, origin: any) => {
      if (origin !== this) {
        const encoder = writeUpdate(createEncoder(), update);
        this.send(toUint8Array(encoder));
      }
    };

    this._awarenessUpdateHandler = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const changedClients = added.concat(updated).concat(removed);
      const encoderAwareness = encodeAwarenessUpdate(this.awareness, changedClients);
      this.send(encoderAwareness);
    };

    this._awarenessChangeHandler = () => {};

    this.doc.on('update', this._updateHandler);
    this.awareness.on('update', this._awarenessUpdateHandler);
    this.awareness.on('change', this._awarenessChangeHandler);
  }

  get synced(): boolean {
    return this._synced;
  }

  get wsconnected_status(): boolean {
    return this.wsconnected;
  }

  connect(): void {
    this.shouldConnect = true;
    this._connect();
  }

  private _connect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.channel = null;
    }

    this.socket = new Socket(this.websocketUrl, {
      params: {},
      heartbeatIntervalMs: 30000
    });

    this.socket.onError((error) => {
      console.error('[PhoenixProvider] Socket error:', error);
      this.wsconnected = false;
      this._setSynced(false);
      this._emitConnectionError(error as Error);
    });

    this.socket.onClose(() => {
      console.log('[PhoenixProvider] Socket closed');
      this.wsconnected = false;
      this._setSynced(false);
      this._emitConnectionClose();
      if (this.shouldConnect) {
        this._scheduleReconnect();
      }
    });

    this.socket.connect();

    this.channel = this.socket.channel(this.roomName, {});

    this.channel.join()
      .receive('ok', (resp: any) => {
        console.log('[PhoenixProvider] Joined channel:', this.roomName, resp);
        this.wsconnected = true;
        this.reconnectAttempts = 0;
        this._emitStatus('connected');

        this.channel!.on('binary_msg', (payload: any) => {
          this._handleMessage(payload.data);
        });

        this.channel!.on('sync_step1', (payload: any) => {
          this._handleMessage(payload.data);
        });

        this.channel!.on('sync_step2', (payload: any) => {
          this._handleMessage(payload.data);
        });

        this.channel!.on('update', (payload: any) => {
          this._handleMessage(payload.data);
        });

        this.channel!.on('awareness', (payload: any) => {
          this._handleMessage(payload.data);
        });

        this._setSynced(true);

        const encoder = writeSyncStep1(createEncoder(), this.doc);
        this.send(toUint8Array(encoder));

        this._flushMessageQueue();
      })
      .receive('error', (resp: any) => {
        console.error('[PhoenixProvider] Unable to join:', resp);
        this.wsconnected = false;
        this._setSynced(false);
      })
      .receive('timeout', () => {
        console.error('[PhoenixProvider] Channel join timeout');
        this.wsconnected = false;
        this._setSynced(false);
        if (this.shouldConnect) {
          this._scheduleReconnect();
        }
      });
  }

  private _handleMessage(dataBase64: string): void {
    const data = base64ToUint8Array(dataBase64);
    const decoder = createDecoder(data);
    const firstByte = readVarUint(decoder);

    switch (firstByte) {
      case messageYjsSyncStep1: {
        const encoder = writeSyncStep2(createEncoder(), this.doc, decoder);
        this.send(toUint8Array(encoder));
        break;
      }
      case messageYjsSyncStep2: {
        readSyncMessage(decoder, this.doc, this.awareness, this);
        break;
      }
      case messageYjsUpdate: {
        readSyncMessage(decoder, this.doc, this.awareness, this);
        break;
      }
      case messageYjsAwareness: {
        applyAwarenessUpdate(this.awareness, data.slice(1), this);
        break;
      }
    }
  }

  send(message: Uint8Array): void {
    if (!this.wsconnected || !this.channel) {
      this.messageQueue.push(message);
      return;
    }

    const firstByte = message[0];

    let eventName = 'binary_msg';
    if (firstByte === messageYjsAwareness) {
      eventName = 'awareness';
    } else if (firstByte === messageYjsSyncStep1) {
      eventName = 'sync_step1';
    } else if (firstByte === messageYjsSyncStep2) {
      eventName = 'sync_step2';
    } else if (firstByte === messageYjsUpdate) {
      eventName = 'update';
    }

    this.channel.push(eventName, {
      data: uint8ArrayToBase64(message)
    });
  }

  private _flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) {
        this.send(msg);
      }
    }
  }

  private _setSynced(state: boolean): void {
    if (this._synced !== state) {
      this._synced = state;
      this.syncListeners.forEach(l => l(state));
    }
  }

  private _emitStatus(status: string): void {
    this.statusListeners.forEach(l => l({ status }));
  }

  private _emitConnectionClose(): void {
    this.connectionCloseListeners.forEach(l => l());
  }

  private _emitConnectionError(error: Error): void {
    this.connectionErrorListeners.forEach(l => l(error));
  }

  private _scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`[PhoenixProvider] Max reconnection attempts reached (${this.maxReconnectAttempts})`);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), 30000);

    console.log(`[PhoenixProvider] Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (this.shouldConnect && !this.wsconnected) {
        this._connect();
      }
    }, delay);
  }

  on(event: 'status' | 'sync' | 'connection-close' | 'connection-error', handler: any): () => void {
    if (event === 'status') {
      this.statusListeners.add(handler);
      return () => this.statusListeners.delete(handler);
    }
    if (event === 'sync') {
      this.syncListeners.add(handler);
      return () => this.syncListeners.delete(handler);
    }
    if (event === 'connection-close') {
      this.connectionCloseListeners.add(handler);
      return () => this.connectionCloseListeners.delete(handler);
    }
    if (event === 'connection-error') {
      this.connectionErrorListeners.add(handler);
      return () => this.connectionErrorListeners.delete(handler);
    }
    return () => {};
  }

  disconnect(): void {
    this.shouldConnect = false;
    if (this.channel) {
      removeAwarenessStates(this.awareness, [this.doc.clientID], this);
      const encoderAwareness = encodeAwarenessUpdate(this.awareness, [this.doc.clientID]);
      this.send(encoderAwareness);
    }
    this.doc.off('update', this._updateHandler);
    this.awareness.off('update', this._awarenessUpdateHandler);
    this.awareness.off('change', this._awarenessChangeHandler);
    if (this.channel) {
      try {
        this.channel.leave();
      } catch (e) {}
      this.channel = null;
    }
    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch (e) {}
      this.socket = null;
    }
    this.wsconnected = false;
    this._synced = false;
    this._emitStatus('disconnected');
  }

  destroy(): void {
    this.disconnect();
    this.statusListeners.clear();
    this.syncListeners.clear();
    this.connectionCloseListeners.clear();
    this.connectionErrorListeners.clear();
    this.messageQueue = [];
  }
}
