const workerId = localStorage.getItem('workerId') || Math.random().toString(36).substring(2, 10);
localStorage.setItem('workerId', workerId);

const cores = navigator.hardwareConcurrency || 1;

let socket = null;
let raytracerWorker = null;
let isConnected = false;
let currentTask = null;
let currentTaskVersion = 0;
let lastProgress = 0;
let heartbeatInterval = null;
let stats = {
  tilesCompleted: parseInt(localStorage.getItem('tilesCompleted') || '0'),
  totalRenderTime: parseInt(localStorage.getItem('totalRenderTime') || '0')
};

const elements = {
  serverUrl: document.getElementById('serverUrl'),
  connectBtn: document.getElementById('connectBtn'),
  connectIcon: document.getElementById('connectIcon'),
  connectText: document.getElementById('connectText'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  tilesCompleted: document.getElementById('tilesCompleted'),
  totalTime: document.getElementById('totalTime'),
  avgSpeed: document.getElementById('avgSpeed'),
  workerCores: document.getElementById('workerCores'),
  taskProgress: document.getElementById('taskProgress'),
  progressFill: document.getElementById('progressFill'),
  ringCircle: document.getElementById('ringCircle'),
  ringText: document.getElementById('ringText'),
  ringSubtext: document.getElementById('ringSubtext'),
  tileInfo: document.getElementById('tileInfo'),
  tileCanvas: document.getElementById('tileCanvas'),
  idleState: document.getElementById('idleState'),
  canvasWrapper: document.getElementById('canvasWrapper'),
  currentTask: document.getElementById('currentTask'),
  currentTileInfo: document.getElementById('currentTileInfo')
};

elements.workerCores.textContent = cores;
updateStatsDisplay();

function updateStatsDisplay() {
  elements.tilesCompleted.textContent = stats.tilesCompleted;
  elements.totalTime.textContent = formatTime(stats.totalRenderTime);
  
  if (stats.tilesCompleted > 0) {
    const avgTime = stats.totalRenderTime / stats.tilesCompleted;
    elements.avgSpeed.textContent = avgTime > 1000 ? (avgTime / 1000).toFixed(1) + 's' : avgTime.toFixed(0) + 'ms';
  }
}

function formatTime(ms) {
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  return (ms / 60000).toFixed(1) + 'm';
}

function setStatus(status, text) {
  elements.statusDot.className = 'status-dot ' + status;
  elements.statusText.textContent = text;
}

function setProgress(progress) {
  elements.taskProgress.textContent = progress + '%';
  elements.progressFill.style.width = progress + '%';
  
  const circumference = 251.2;
  const offset = circumference - (progress / 100) * circumference;
  elements.ringCircle.style.strokeDashoffset = offset;
  elements.ringText.textContent = progress + '%';
}

function showCanvas(tile) {
  elements.idleState.style.display = 'none';
  elements.tileCanvas.style.display = 'block';
  elements.tileCanvas.width = tile.width;
  elements.tileCanvas.height = tile.height;
  elements.tileInfo.textContent = `Tile: (${tile.x}, ${tile.y}) ${tile.width}x${tile.height}`;
  elements.currentTask.style.display = 'block';
  elements.currentTileInfo.textContent = `ID: ${tile.tileId} | 位置: (${tile.x}, ${tile.y}) | 尺寸: ${tile.width}×${tile.height}`;
  elements.ringSubtext.textContent = '渲染中...';
}

function showIdle() {
  elements.idleState.style.display = 'block';
  elements.tileCanvas.style.display = 'none';
  elements.tileInfo.textContent = '无任务';
  elements.currentTask.style.display = 'none';
  elements.ringSubtext.textContent = '等待任务';
}

function updatePreview(pixelData, width, height) {
  const canvas = elements.tileCanvas;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  
  for (let i = 0; i < pixelData.length; i++) {
    imgData.data[i] = pixelData[i];
  }
  
  ctx.putImageData(imgData, 0, 0);
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatInterval = setInterval(() => {
    if (socket && isConnected) {
      socket.emit('heartbeat', {
        workerId,
        tileId: currentTask ? currentTask.tileId : null,
        progress: lastProgress,
        isBackground: document.hidden
      });
    }
  }, 10000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function initWorker() {
  if (raytracerWorker) {
    raytracerWorker.terminate();
  }
  
  raytracerWorker = new Worker('/js/raytracer.worker.js');
  
  raytracerWorker.onmessage = (e) => {
    const { type, tileId, pixelData, renderTime, progress, error } = e.data;
    
    if (type === 'workerHeartbeat') {
      if (socket && isConnected) {
        socket.emit('heartbeat', {
          workerId,
          tileId,
          progress,
          isBackground: document.hidden
        });
      }
    } else if (type === 'progress') {
      lastProgress = progress;
      setProgress(progress);
      if (socket) {
        socket.emit('workerStatus', {
          workerId,
          tileId,
          progress
        });
      }
    } else if (type === 'complete') {
      updatePreview(pixelData, currentTask.width, currentTask.height);
      setProgress(100);
      lastProgress = 100;
      
      stats.tilesCompleted++;
      stats.totalRenderTime += renderTime;
      localStorage.setItem('tilesCompleted', stats.tilesCompleted);
      localStorage.setItem('totalRenderTime', stats.totalRenderTime);
      updateStatsDisplay();
      
      if (socket) {
        socket.emit('submitTile', {
          workerId,
          tileId,
          pixelData,
          renderTime,
          version: currentTaskVersion
        });
      }
      
      currentTask = null;
      currentTaskVersion = 0;
      lastProgress = 0;
      elements.ringSubtext.textContent = '任务完成';
      
      setTimeout(() => {
        requestNextTask();
      }, 500);
    } else if (type === 'error') {
      console.error('Raytracer error:', error);
      elements.ringSubtext.textContent = '错误: ' + error;
      currentTask = null;
      currentTaskVersion = 0;
      lastProgress = 0;
      setTimeout(requestNextTask, 1000);
    }
  };
}

function requestNextTask() {
  if (!socket || !isConnected) return;
  
  setProgress(0);
  lastProgress = 0;
  showIdle();
  socket.emit('requestTask', { workerId });
}

function connect() {
  const serverUrl = elements.serverUrl.value.trim();
  if (!serverUrl) return;
  
  elements.connectBtn.disabled = true;
  elements.connectText.textContent = '连接中...';
  setStatus('connecting', '正在连接...');
  
  try {
    socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000
    });
    
    socket.on('connect', () => {
      isConnected = true;
      setStatus('connected', '已连接');
      elements.connectText.textContent = '断开连接';
      elements.connectIcon.textContent = '🔌';
      elements.connectBtn.disabled = false;
      elements.connectBtn.classList.remove('btn-primary');
      elements.connectBtn.classList.add('btn-secondary');
      
      socket.emit('workerJoin', { workerId, cores });
      initWorker();
      startHeartbeat();
      
      socket.emit('visibilityChange', {
        workerId,
        isBackground: document.hidden
      });
      
      setTimeout(requestNextTask, 500);
    });
    
    socket.on('disconnect', () => {
      isConnected = false;
      setStatus('disconnected', '已断开');
      resetConnectionUI();
      stopHeartbeat();
      
      if (raytracerWorker) {
        raytracerWorker.postMessage({ type: 'cancel' });
      }
    });
    
    socket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setStatus('disconnected', '连接失败');
      resetConnectionUI();
    });
    
    socket.on('taskAssigned', (task) => {
      currentTask = task;
      currentTaskVersion = task.version || 0;
      lastProgress = 0;
      showCanvas(task);
      setProgress(0);
      
      raytracerWorker.postMessage({
        type: 'render',
        data: task
      });
    });
    
    socket.on('noTaskAvailable', () => {
      elements.ringSubtext.textContent = '暂无任务';
      setTimeout(requestNextTask, 3000);
    });
    
    socket.on('taskCancelled', () => {
      if (raytracerWorker) {
        raytracerWorker.postMessage({ type: 'cancel' });
      }
      currentTask = null;
      currentTaskVersion = 0;
      lastProgress = 0;
      setTimeout(requestNextTask, 500);
    });
    
    socket.on('tileRejected', ({ tileId, reason }) => {
      console.warn(`Tile ${tileId} rejected: ${reason}`);
      
      if (currentTask && currentTask.tileId === tileId) {
        currentTask = null;
        currentTaskVersion = 0;
        lastProgress = 0;
      }
      
      elements.ringSubtext.textContent = '任务被拒绝 (' + reason + ')';
      setTimeout(requestNextTask, 1000);
    });
    
  } catch (err) {
    console.error('Failed to connect:', err);
    setStatus('disconnected', '连接失败');
    resetConnectionUI();
  }
}

function disconnect() {
  stopHeartbeat();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  if (raytracerWorker) {
    raytracerWorker.terminate();
    raytracerWorker = null;
  }
  isConnected = false;
  currentTask = null;
  currentTaskVersion = 0;
  lastProgress = 0;
  resetConnectionUI();
  setStatus('disconnected', '已断开');
  showIdle();
  setProgress(0);
}

function resetConnectionUI() {
  elements.connectBtn.disabled = false;
  elements.connectText.textContent = '连接服务端';
  elements.connectIcon.textContent = '🔌';
  elements.connectBtn.classList.add('btn-primary');
  elements.connectBtn.classList.remove('btn-secondary');
}

document.addEventListener('visibilitychange', () => {
  if (!socket || !isConnected) return;
  
  const isBackground = document.hidden;
  
  socket.emit('visibilityChange', {
    workerId,
    isBackground
  });
  
  if (isBackground) {
    setStatus('connected', '已连接 (后台)');
  } else {
    setStatus('connected', '已连接');
    if (currentTask && raytracerWorker) {
      raytracerWorker.postMessage({ type: 'ping' });
    }
  }
});

elements.connectBtn.addEventListener('click', () => {
  if (isConnected) {
    disconnect();
  } else {
    connect();
  }
});

elements.serverUrl.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !isConnected) {
    connect();
  }
});

window.addEventListener('beforeunload', () => {
  stopHeartbeat();
  if (raytracerWorker) {
    raytracerWorker.terminate();
  }
});
