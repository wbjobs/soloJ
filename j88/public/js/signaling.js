class SignalingClient {
  constructor() {
    this.socket = null;
    this.handlers = {};
  }

  connect(url = '/') {
    return new Promise((resolve, reject) => {
      this.socket = io(url);

      this.socket.on('connect', () => {
        console.log('[信令] 已连接, id:', this.socket.id);
        resolve(this.socket.id);
      });

      this.socket.on('connect_error', (err) => {
        console.error('[信令] 连接错误:', err);
        reject(err);
      });

      this.socket.on('worker-available', (data) => this._emit('worker-available', data));
      this.socket.on('worker-disconnected', (data) => this._emit('worker-disconnected', data));
      this.socket.on('available-workers', (data) => this._emit('available-workers', data));
      this.socket.on('execute-task', (task) => this._emit('execute-task', task));
      this.socket.on('task-result', (result) => this._emit('task-result', result));
      this.socket.on('task-error', (data) => this._emit('task-error', data));
      this.socket.on('worker-progress', (data) => this._emit('worker-progress', data));
      this.socket.on('controller-registered', (data) => this._emit('controller-registered', data));
      this.socket.on('worker-registered', (data) => this._emit('worker-registered', data));
      this.socket.on('controller-disconnected', () => this._emit('controller-disconnected'));
      this.socket.on('webrtc-offer', (data) => this._emit('webrtc-offer', data));
      this.socket.on('webrtc-answer', (data) => this._emit('webrtc-answer', data));
      this.socket.on('webrtc-ice-candidate', (data) => this._emit('webrtc-ice-candidate', data));

      this.socket.on('disconnect', () => {
        console.log('[信令] 已断开');
        this._emit('disconnect');
      });
    });
  }

  on(event, handler) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(handler);
  }

  _emit(event, data) {
    const handlers = this.handlers[event] || [];
    handlers.forEach((h) => h(data));
  }

  registerController() {
    this.socket.emit('register-controller');
  }

  registerWorker() {
    this.socket.emit('register-worker');
  }

  requestWorkers() {
    this.socket.emit('request-workers');
  }

  assignTask(workerId, task) {
    this.socket.emit('assign-task', { workerId, task });
  }

  taskCompleted(controllerId, result) {
    this.socket.emit('task-completed', { controllerId, result });
  }

  taskProgress(controllerId, progress) {
    this.socket.emit('task-progress', { controllerId, progress });
  }

  sendOffer(targetId, offer) {
    this.socket.emit('webrtc-offer', { targetId, offer });
  }

  sendAnswer(targetId, answer) {
    this.socket.emit('webrtc-answer', { targetId, answer });
  }

  sendIceCandidate(targetId, candidate) {
    this.socket.emit('webrtc-ice-candidate', { targetId, candidate });
  }

  get id() {
    return this.socket ? this.socket.id : null;
  }

  disconnect() {
    if (this.socket) this.socket.disconnect();
  }
}
