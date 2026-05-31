class WorkerApp {
  constructor() {
    this.signaling = new SignalingClient();
    this.webrtc = null;
    this.controllerId = null;
    this.factorWorker = null;
    this.currentTask = null;
    this.tasksCompleted = 0;
    this.factorsFound = 0;
    this.heartbeatTimer = null;

    this._setupSignaling();
  }

  _setupSignaling() {
    this.signaling.on('worker-registered', (data) => {
      this.log(`工作端已注册, ID: ${data.workerId}`);
      document.getElementById('status').textContent = '已连接 · 等待任务';
      document.getElementById('status').className = 'status connected';
      this._startHeartbeat();
    });

    this.signaling.on('execute-task', (task) => {
      this._executeTask(task);
    });

    this.signaling.on('controller-disconnected', () => {
      this.log('主控端已断开连接');
      this.controllerId = null;
      document.getElementById('status').textContent = '已连接 · 等待主控';
      if (this.factorWorker) {
        this.factorWorker.terminate();
        this.factorWorker = null;
      }
    });

    this.signaling.on('webrtc-offer', async ({ fromId, offer }) => {
      this.controllerId = fromId;
    });

    this.signaling.on('disconnect', () => {
      document.getElementById('status').textContent = '已断开';
      document.getElementById('status').className = 'status disconnected';
      this._stopHeartbeat();
    });
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.signaling.socket && this.signaling.socket.connected) {
        this.signaling.socket.emit('worker-heartbeat');
      }
    }, 5000);
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async connect() {
    const myId = await this.signaling.connect();
    this.webrtc = new WebRTCManager(this.signaling);

    this.webrtc.onDataReceived = (peerId, data) => {
      if (data.type === 'cancel-task') {
        if (this.factorWorker) {
          this.factorWorker.terminate();
          this.factorWorker = null;
          this.log('任务已被主控端取消');
        }
      }
    };

    this.webrtc.onChannelOpen = (peerId) => {
      this.controllerId = peerId;
      this.log(`WebRTC DataChannel 已建立 (主控端: ${peerId.substring(0, 8)}...)`);
      document.getElementById('channel-status').textContent = 'DataChannel: 已连接';
      document.getElementById('channel-status').className = 'status connected';
    };

    this.webrtc.onChannelClose = (peerId) => {
      this.log(`WebRTC DataChannel 已关闭`);
      document.getElementById('channel-status').textContent = 'DataChannel: 未连接';
      document.getElementById('channel-status').className = 'status disconnected';
    };

    this.signaling.registerWorker();
  }

  _executeTask(task) {
    this.currentTask = task;
    this.taskStartTime = Date.now();
    this.controllerId = this.controllerId || null;

    const rangeStart = BigInt(task.rangeStart);
    const rangeEnd = BigInt(task.rangeEnd);
    const rangeSize = Number(rangeEnd - rangeStart + 1n);

    this.log(`收到任务 ${task.taskId}: 分解 ${task.number}, 范围 ${task.rangeStart}~${task.rangeEnd} (${rangeSize} 个数)`);
    document.getElementById('status').textContent = '已连接 · 计算中...';
    document.getElementById('status').className = 'status computing';
    document.getElementById('current-task').textContent = `${task.taskId}: ${task.rangeStart} ~ ${task.rangeEnd}`;
    document.getElementById('task-number').textContent = task.number;

    if (this.factorWorker) {
      this.factorWorker.terminate();
    }

    this.factorWorker = new Worker('/js/factor-worker.js');

    this.factorWorker.onmessage = (e) => {
      const msg = e.data;

      if (msg.type === 'progress') {
        this._updateProgress(msg.percent);
        if (this.controllerId) {
          this.signaling.taskProgress(this.controllerId, {
            taskId: msg.taskId,
            percent: msg.percent,
          });
        }
      }

      if (msg.type === 'result') {
        this._handleResult(msg);
      }
    };

    this.factorWorker.onerror = (err) => {
      this.log(`Web Worker 错误: ${err.message}`);
      this.factorWorker.terminate();
      this.factorWorker = null;
      document.getElementById('status').textContent = '已连接 · 等待任务';
      document.getElementById('status').className = 'status connected';
    };

    this.factorWorker.postMessage({
      taskId: task.taskId,
      number: task.number,
      rangeStart: task.rangeStart,
      rangeEnd: task.rangeEnd,
    });
  }

  _handleResult(result) {
    const elapsedMs = Date.now() - this.taskStartTime;
    const rangeStart = BigInt(this.currentTask.rangeStart);
    const rangeEnd = BigInt(this.currentTask.rangeEnd);
    const rangeSize = Number(rangeEnd - rangeStart + 1n);
    const throughput = rangeSize / (elapsedMs / 1000);

    this.tasksCompleted++;
    if (result.factors && result.factors.length > 0) {
      this.factorsFound += result.factors.length;
    }

    const resultWithMetrics = {
      ...result,
      elapsedMs,
      rangeSize,
      throughput,
    };

    this.log(
      `任务 ${result.taskId} 完成! 耗时 ${elapsedMs}ms, 算力 ${throughput.toFixed(0)} 数/秒, 找到 ${result.factors.length} 个因子` +
        (result.factors.length > 0 ? `: ${result.factors.join(', ')}` : '')
    );

    const sentViaWebRTC = this.controllerId && this.webrtc.sendData(this.controllerId, {
      type: 'factor-result',
      result: resultWithMetrics,
    });

    if (sentViaWebRTC) {
      this.log('结果已通过 WebRTC DataChannel 发送');
    } else {
      this.signaling.taskCompleted(this.controllerId || this.signaling.id, resultWithMetrics);
      this.log('结果已通过信令服务器发送');
    }

    document.getElementById('status').textContent = '已连接 · 等待任务';
    document.getElementById('status').className = 'status connected';
    document.getElementById('tasks-done').textContent = this.tasksCompleted;
    document.getElementById('factors-found').textContent = this.factorsFound;
    document.getElementById('current-task').textContent = '无';
    document.getElementById('task-number').textContent = '-';
    this._updateProgress(0);

    if (this.factorWorker) {
      this.factorWorker.terminate();
      this.factorWorker = null;
    }
  }

  _updateProgress(percent) {
    document.getElementById('progress-bar').style.width = percent + '%';
    document.getElementById('progress-text').textContent = percent + '%';
  }

  log(msg) {
    const el = document.getElementById('log');
    const time = new Date().toLocaleTimeString();
    el.innerHTML += `<div class="log-entry"><span class="log-time">[${time}]</span> ${msg}</div>`;
    el.scrollTop = el.scrollHeight;
  }
}

const app = new WorkerApp();

document.getElementById('btn-connect').addEventListener('click', async () => {
  document.getElementById('btn-connect').disabled = true;
  await app.connect();
});
