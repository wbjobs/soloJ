import * as THREE from 'three';

class Network {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.onInit = null;
    this.onPlayerJoin = null;
    this.onPlayerLeave = null;
    this.onPlayerMove = null;
    this.onBlockChange = null;
    this.onBlockChangeAck = null;
    this.onWorldRollback = null;
    this.connected = false;
    this._pendingBlocks = new Map();
    this._reqCounter = 0;
  }

  connect(url) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.connected = true;
        resolve();
      };

      this.ws.onerror = (err) => {
        reject(err);
      };

      this.ws.onclose = () => {
        this.connected = false;
        for (const pending of this._pendingBlocks.values()) {
          pending.reject(new Error('Connection closed'));
        }
        this._pendingBlocks.clear();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this._handleMessage(msg);
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };
    });
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'init':
        this.playerId = msg.data.player_id;
        if (this.onInit) this.onInit(msg.data);
        break;
      case 'player_join':
        if (this.onPlayerJoin) this.onPlayerJoin(msg.data);
        break;
      case 'player_leave':
        if (this.onPlayerLeave) this.onPlayerLeave(msg.data);
        break;
      case 'player_move':
        if (this.onPlayerMove) this.onPlayerMove(msg.data);
        break;
      case 'block_change':
        if (this.onBlockChange) this.onBlockChange(msg.data);
        break;
      case 'block_change_ack':
        this._handleBlockAck(msg.data);
        break;
      case 'world_rollback':
        if (this.onWorldRollback) this.onWorldRollback(msg.data);
        break;
    }
  }

  _handleBlockAck(data) {
    const reqId = data.req_id;
    const pending = this._pendingBlocks.get(reqId);
    if (pending) {
      this._pendingBlocks.delete(reqId);
      if (data.applied) {
        pending.resolve(data);
      } else {
        pending.reject(new Error(data.reason || 'Block change not applied'));
      }
    }
    if (this.onBlockChangeAck) {
      this.onBlockChangeAck(data);
    }
  }

  sendMove(x, y, z, rx, ry) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({
      type: 'player_move',
      data: { x, y, z, rx, ry },
    }));
  }

  sendBlockChange(x, y, z, block) {
    if (!this.connected) return Promise.reject(new Error('Not connected'));

    this._reqCounter++;
    const reqId = `${this.playerId}_${this._reqCounter}_${Date.now()}`;

    this.ws.send(JSON.stringify({
      type: 'block_change',
      data: { x, y, z, block, req_id: reqId },
    }));

    return new Promise((resolve, reject) => {
      this._pendingBlocks.set(reqId, { resolve, reject });
      setTimeout(() => {
        if (this._pendingBlocks.has(reqId)) {
          this._pendingBlocks.delete(reqId);
          reject(new Error('Timeout waiting for block change ack'));
        }
      }, 5000);
    });
  }
}

export { Network };
