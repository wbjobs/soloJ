export class SocketClient {
  constructor() {
    this.socket = null;
    this.eventListeners = {};
    this._init();
  }

  _init() {
    this.socket = io();

    this.socket.on('connect', () => {
    });

    this.socket.on('disconnect', () => {
    });

    this.socket.on('joined', (data) => {
      this._emit('joined', data);
    });

    this.socket.on('user-joined', (data) => {
      this._emit('user-joined', data);
    });

    this.socket.on('user-left', (data) => {
      this._emit('user-left', data);
    });

    this.socket.on('camera-update', (data) => {
      this._emit('camera-update', data);
    });

    this.socket.on('annotation-added', (data) => {
      this._emit('annotation-added', data);
    });

    this.socket.on('annotation-resolved', (data) => {
      this._emit('annotation-resolved', data);
    });

    this.socket.on('view-locked', (data) => {
      this._emit('view-locked', data);
    });

    this.socket.on('view-unlocked', (data) => {
      this._emit('view-unlocked', data);
    });

    this.socket.on('signal', (data) => {
      this._emit('signal', data);
    });

    this.socket.on('model-transform-updated', (data) => {
      this._emit('model-transform-updated', data);
    });
  }

  joinRoom(data) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.socket.emit('join-room', data, (response) => {
        clearTimeout(timeout);
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to join room'));
        }
      });
    });
  }

  leaveRoom() {
    this.socket.emit('leave-room', {}, (response) => {
    });
    this.socket.disconnect();
  }

  sendCameraUpdate(camera) {
    this.socket.emit('camera-update', { camera });
  }

  addAnnotation(data) {
    this.socket.emit('annotation-add', data);
  }

  resolveAnnotation(annotationId) {
    this.socket.emit('annotation-resolve', { annotationId });
  }

  lockView(view) {
    this.socket.emit('lock-view', { view });
  }

  unlockView() {
    this.socket.emit('unlock-view', {});
  }

  sendSignal(to, signalData) {
    this.socket.emit('signal', {
      to,
      type: signalData.type,
      payload: signalData
    });
  }

  sendModelTransform(transform) {
    this.socket.emit('model-transform', { transform });
  }

  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  _emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(cb => cb(data));
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
