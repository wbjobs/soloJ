class ControllerApp {
  constructor() {
    this.signaling = new SignalingClient();
    this.webrtc = null;
    this.workers = new Map();
    this.taskResults = [];
    this.targetNumber = '';
    this.taskQueue = [];
    this.dispatchedTasks = new Map();
    this.isRunning = false;
    this.startTime = null;
    this.totalTasks = 0;
    this.completedTasks = 0;
    this.nextTaskId = 0;
    this.currentStart = 2n;
    this.sqrtN = 0n;
    this.defaultChunkSize = 100;
    this.minChunkSize = 50;
    this.maxChunkSize = 10000;
    this.targetTaskTimeMs = 3000;

    this._setupSignaling();
  }

  _setupSignaling() {
    this.signaling.on('controller-registered', (data) => {
      this.log(`主控端已注册, ID: ${data.controllerId}`);
      document.getElementById('status').textContent = '已连接';
      document.getElementById('status').className = 'status connected';
    });

    this.signaling.on('worker-available', (data) => {
      this._addWorker(data.workerId);
    });

    this.signaling.on('available-workers', (data) => {
      data.workers.forEach((wid) => this._addWorker(wid));
    });

    this.signaling.on('worker-disconnected', (data) => {
      this._removeWorker(data.workerId, data.lostTask);
    });

    this.signaling.on('worker-timeout', (data) => {
      this.log(`工作端 ${data.workerId.substring(0, 8)}... 任务超时，重新分配任务`);
      this._requeueTask(data.lostTask);
    });

    this.signaling.on('worker-progress', (data) => {
      this._updateWorkerProgress(data.workerId, data.percent);
    });

    this.signaling.on('task-result', (result) => {
      this._handleTaskResult(result);
    });

    this.signaling.on('task-error', (data) => {
      this.log(`任务错误 (工作端 ${data.workerId}): ${data.error}`);
      this._markWorkerIdle(data.workerId);
      this._dispatchNextTask(data.workerId);
    });

    this.signaling.on('disconnect', () => {
      document.getElementById('status').textContent = '已断开';
      document.getElementById('status').className = 'status disconnected';
    });
  }

  async connect() {
    const myId = await this.signaling.connect();
    this.webrtc = new WebRTCManager(this.signaling);
    this.webrtc.onDataReceived = (peerId, data) => {
      if (data.type === 'factor-result') {
        this._handleTaskResult(data.result);
      }
    };
    this.webrtc.onChannelOpen = (peerId) => {
      this.log(`WebRTC DataChannel 与工作端 ${peerId.substring(0, 8)}... 已建立`);
      this._updateWorkerChannel(peerId, true);
    };
    this.signaling.registerController();
    this.signaling.requestWorkers();
  }

  _addWorker(workerId) {
    if (!this.workers.has(workerId)) {
      this.workers.set(workerId, {
        busy: false,
        channelReady: false,
        progress: 0,
        throughput: 0,
        avgThroughput: 0,
        chunkSize: this.defaultChunkSize,
        tasksCompleted: 0,
        totalNumbersProcessed: 0,
        totalElapsedMs: 0,
        lastTaskTime: 0,
      });
      this.log(`新工作端上线: ${workerId.substring(0, 8)}...`);
      this._renderWorkers();
      this._renderWorkerPower();

      if (this.isRunning) {
        this._setupWebRTCAndDispatch(workerId);
      }
    }
  }

  _removeWorker(workerId, lostTask) {
    this.workers.delete(workerId);
    this.log(`工作端下线: ${workerId.substring(0, 8)}...`);
    if (lostTask) {
      this.log(`  → 任务 ${lostTask.taskId} 丢失，重新加入队列`);
      this._requeueTask(lostTask);
    }
    this._renderWorkers();
  }

  _requeueTask(task) {
    if (!task) return;
    const dispatched = this.dispatchedTasks.get(task.taskId);
    if (dispatched) {
      this.dispatchedTasks.delete(task.taskId);
    }
    this.taskQueue.unshift(task);
    this.completedTasks--;
    this._dispatchQueuedTasksToIdleWorkers();
  }

  _dispatchQueuedTasksToIdleWorkers() {
    while (this.taskQueue.length > 0) {
      let assigned = false;
      for (const [workerId, worker] of this.workers) {
        if (!worker.busy) {
          const task = this.taskQueue.shift();
          if (!task) break;
          worker.busy = true;
          worker.progress = 0;
          this.dispatchedTasks.set(task.taskId, { workerId, task });
          this.signaling.assignTask(workerId, task);
          this.log(`重新分配任务 ${task.taskId} 给工作端 ${workerId.substring(0, 8)}... (范围: ${task.rangeStart}-${task.rangeEnd})`);
          assigned = true;
          break;
        }
      }
      if (!assigned) break;
    }

    for (const [workerId, worker] of this.workers) {
      if (!worker.busy && this.isRunning && this.currentStart <= this.sqrtN) {
        if (this.webrtc.isChannelReady(workerId)) {
          this._dispatchNextTask(workerId);
        } else {
          this._setupWebRTCAndDispatch(workerId);
        }
      }
    }
    this._renderWorkers();
  }

  async _setupWebRTCAndDispatch(workerId) {
    try {
      await this.webrtc.createConnection(workerId);
      const waitChannel = () => {
        return new Promise((resolve) => {
          const check = () => {
            if (this.webrtc.isChannelReady(workerId)) {
              resolve(true);
            } else {
              setTimeout(check, 100);
            }
          };
          check();
        });
      };

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('WebRTC 连接超时')), 10000)
      );

      try {
        await Promise.race([waitChannel(), timeout]);
      } catch (e) {
        this.log(`WebRTC 连接超时，通过信令服务器回退传输`);
      }

      this._dispatchNextTask(workerId);
    } catch (e) {
      this.log(`WebRTC 建立失败: ${e.message}，使用信令服务器`);
      this._dispatchNextTask(workerId);
    }
  }

  _updateWorkerChannel(workerId, ready) {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.channelReady = ready;
      this._renderWorkers();
    }
  }

  _updateWorkerProgress(workerId, percent) {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.progress = percent;
      this._renderWorkers();
    }
  }

  _markWorkerIdle(workerId) {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.busy = false;
      worker.progress = 0;
      this._renderWorkers();
    }
  }

  startFactorization(number) {
    this.targetNumber = number;
    this.taskResults = [];
    this.completedTasks = 0;
    this.totalTasks = 0;
    this.isRunning = true;
    this.startTime = Date.now();
    this.nextTaskId = 0;
    this.currentStart = 2n;

    const n = BigInt(number);
    this.sqrtN = BigInt(Math.floor(Math.sqrt(Number(n))));
    const totalNumbers = Number(this.sqrtN - 2n + 1n);

    this.log(`大整数: ${number}`);
    this.log(`搜索范围: 2 ~ ${this.sqrtN.toString()} (共 ${totalNumbers} 个数)`);
    this.log(`负载均衡策略: 根据节点算力动态调整任务块大小 (目标: ${this.targetTaskTimeMs}ms/任务)`);

    for (const [workerId, worker] of this.workers) {
      worker.throughput = 0;
      worker.avgThroughput = 0;
      worker.chunkSize = this.defaultChunkSize;
      worker.tasksCompleted = 0;
      worker.totalNumbersProcessed = 0;
      worker.totalElapsedMs = 0;
    }

    for (const [workerId] of this.workers) {
      this._setupWebRTCAndDispatch(workerId);
    }

    this._renderWorkerPower();
    this._updateProgress();
  }

  _generateNextTask(workerId) {
    if (this.currentStart > this.sqrtN) return null;

    const worker = this.workers.get(workerId);
    if (!worker) return null;

    const chunkSize = BigInt(worker.chunkSize);
    const end = this.currentStart + chunkSize - 1n;
    const actualEnd = end < this.sqrtN ? end : this.sqrtN;

    const task = {
      taskId: `task-${this.nextTaskId++}`,
      number: this.targetNumber,
      rangeStart: this.currentStart.toString(),
      rangeEnd: actualEnd.toString(),
    };

    this.currentStart = actualEnd + 1n;
    this.totalTasks++;
    return task;
  }

  _dispatchNextTask(workerId) {
    const worker = this.workers.get(workerId);
    if (!worker || worker.busy) return;

    const task = this._generateNextTask(workerId);
    if (!task) return;

    worker.busy = true;
    worker.progress = 0;
    this.dispatchedTasks.set(task.taskId, { workerId, task });
    this.signaling.assignTask(workerId, task);
    this.log(
      `分发任务 ${task.taskId} 给工作端 ${workerId.substring(0, 8)}... ` +
      `(范围: ${task.rangeStart}-${task.rangeEnd}, ` +
      `块大小: ${worker.chunkSize}, ` +
      `预期: ~${(worker.chunkSize / Math.max(worker.avgThroughput || 100, 1)).toFixed(1)}s)`
    );
    this._renderWorkers();
  }

  _handleTaskResult(result) {
    this.completedTasks++;
    const taskId = result.taskId;

    if (result.factors && result.factors.length > 0) {
      this.taskResults.push(result);
      this._renderResults();
    }

    const dispatched = this.dispatchedTasks.get(taskId);
    if (dispatched) {
      const workerId = dispatched.workerId;
      this._updateWorkerMetrics(workerId, result);
      this._markWorkerIdle(workerId);
      this.dispatchedTasks.delete(taskId);
      this._dispatchNextTask(workerId);
    }

    this._renderWorkerPower();
    this._updateProgress();

    const remainingNumbers = Number(this.sqrtN - this.currentStart + 1n);
    const activeWorkers = Array.from(this.workers.values()).filter(w => w.busy).length;
    const allDone = remainingNumbers <= 0 && activeWorkers === 0;

    if (allDone && this.isRunning) {
      this.isRunning = false;
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
      this.log(`所有子任务已完成! 耗时: ${elapsed}s, 共处理 ${this.completedTasks} 个任务`);
      this._renderResults();
    }
  }

  _updateWorkerMetrics(workerId, result) {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    const throughput = result.throughput || 0;
    const elapsedMs = result.elapsedMs || 0;
    const rangeSize = result.rangeSize || 0;

    worker.throughput = throughput;
    worker.tasksCompleted++;
    worker.totalNumbersProcessed += rangeSize;
    worker.totalElapsedMs += elapsedMs;
    worker.lastTaskTime = elapsedMs;

    if (worker.totalElapsedMs > 0) {
      worker.avgThroughput = worker.totalNumbersProcessed / (worker.totalElapsedMs / 1000);
    }

    if (elapsedMs > 0) {
      const adaptationRatio = this.targetTaskTimeMs / elapsedMs;
      const maxAdjust = 2.0;
      const minAdjust = 0.5;
      const ratio = Math.max(minAdjust, Math.min(maxAdjust, adaptationRatio));
      const newChunkSize = Math.round(worker.chunkSize * ratio);
      worker.chunkSize = Math.max(this.minChunkSize, Math.min(this.maxChunkSize, newChunkSize));
    }

    this.log(
      `工作端 ${workerId.substring(0, 8)}... 算力: ${throughput.toFixed(0)} 数/秒, ` +
      `平均: ${worker.avgThroughput.toFixed(0)} 数/秒, ` +
      `块大小调整: ${Math.round(worker.chunkSize)}`
    );
  }

  _updateProgress() {
    const percent = this.totalTasks > 0 ? Math.round((this.completedTasks / this.totalTasks) * 100) : 0;
    document.getElementById('progress-bar').style.width = percent + '%';
    document.getElementById('progress-text').textContent =
      `总进度: ${this.completedTasks}/${this.totalTasks} (${percent}%)`;
  }

  _renderWorkers() {
    const container = document.getElementById('worker-list');
    if (this.workers.size === 0) {
      container.innerHTML = '<div class="empty-state">等待工作端连接...</div>';
      return;
    }

    let html = '';
    for (const [id, w] of this.workers) {
      const shortId = id.substring(0, 8) + '...';
      const statusClass = w.busy ? 'worker-busy' : 'worker-idle';
      const statusText = w.busy ? '计算中' : '空闲';
      const channelIcon = w.channelReady ? '🔗' : '📡';
      const progressHtml = w.busy
        ? `<div class="mini-progress"><div class="mini-progress-bar" style="width:${w.progress}%"></div></div>`
        : '';

      html += `
        <div class="worker-card ${statusClass}">
          <div class="worker-info">
            <span class="worker-id">${channelIcon} ${shortId}</span>
            <span class="worker-status ${statusClass}">${statusText}</span>
          </div>
          ${progressHtml}
        </div>
      `;
    }
    container.innerHTML = html;

    document.getElementById('worker-count').textContent = this.workers.size;
  }

  _renderWorkerPower() {
    const container = document.getElementById('worker-power');
    if (!container) return;

    const workers = Array.from(this.workers.entries());
    if (workers.length === 0) {
      container.innerHTML = '<div class="empty-state">等待工作端连接...</div>';
      return;
    }

    const totalThroughput = workers.reduce((sum, [, w]) => sum + w.avgThroughput, 0);
    const maxThroughput = Math.max(...workers.map(([, w]) => Math.max(w.avgThroughput, 1)), 1);

    let html = `
      <div class="power-header">
        <span>总算力</span>
        <span class="total-power">${totalThroughput.toFixed(0)} 数/秒</span>
      </div>
    `;

    for (const [id, w] of workers) {
      const shortId = id.substring(0, 8) + '...';
      const powerPct = totalThroughput > 0 ? (w.avgThroughput / totalThroughput) * 100 : 0;
      const barWidth = (w.avgThroughput / maxThroughput) * 100;
      const hue = 120 - (powerPct * 1.2);

      html += `
        <div class="power-bar-container">
          <div class="power-bar-info">
            <span class="power-worker-id">${shortId}</span>
            <div class="power-stats">
              <span class="power-throughput">${w.avgThroughput.toFixed(0)} 数/秒</span>
              <span class="power-chunk">块: ${Math.round(w.chunkSize)}</span>
              <span class="power-tasks">任务: ${w.tasksCompleted}</span>
            </div>
          </div>
          <div class="power-bar-bg">
            <div class="power-bar-fill" style="width:${barWidth}%; background: hsl(${hue}, 70%, 50%)"></div>
          </div>
          <div class="power-bar-footer">
            <span class="power-pct">${powerPct.toFixed(1)}%</span>
            ${w.lastTaskTime ? `<span class="power-last-time">上次: ${w.lastTaskTime}ms</span>` : ''}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  _renderResults() {
    const container = document.getElementById('results');
    if (this.taskResults.length === 0) {
      container.innerHTML = '<div class="empty-state">尚未找到因子</div>';
      return;
    }

    const allFactors = new Set();
    for (const r of this.taskResults) {
      r.factors.forEach((f) => allFactors.add(f));
    }

    const factorArray = Array.from(allFactors).sort((a, b) => {
      const ba = BigInt(a);
      const bb = BigInt(b);
      return ba < bb ? -1 : ba > bb ? 1 : 0;
    });

    let html = `<div class="factors-header">已找到 ${factorArray.length} 个因子</div>`;
    html += '<div class="factors-grid">';
    for (const f of factorArray) {
      html += `<div class="factor-chip">${f}</div>`;
    }
    html += '</div>';

    html += '<div class="verification">';
    const n = BigInt(this.targetNumber);
    let product = 1n;
    for (const f of factorArray) {
      product *= BigInt(f);
    }
    if (product === n) {
      html += '<span class="verify-ok">✓ 因子乘积验证通过</span>';
    } else {
      html += '<span class="verify-partial">⚠ 仅找到部分因子（可能需要更大的搜索范围）</span>';
    }
    html += '</div>';

    container.innerHTML = html;
  }

  log(msg) {
    const el = document.getElementById('log');
    const time = new Date().toLocaleTimeString();
    el.innerHTML += `<div class="log-entry"><span class="log-time">[${time}]</span> ${msg}</div>`;
    el.scrollTop = el.scrollHeight;
  }
}

const app = new ControllerApp();

document.getElementById('btn-connect').addEventListener('click', async () => {
  document.getElementById('btn-connect').disabled = true;
  await app.connect();
});

document.getElementById('btn-start').addEventListener('click', () => {
  const number = document.getElementById('input-number').value.trim();
  if (!number || !/^\d+$/.test(number)) {
    alert('请输入有效的正整数');
    return;
  }
  const n = BigInt(number);
  if (n < 2n) {
    alert('请输入大于1的整数');
    return;
  }
  app.startFactorization(number);
});

document.getElementById('btn-refresh').addEventListener('click', () => {
  app.signaling.requestWorkers();
});
