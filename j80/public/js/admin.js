const socket = io();

let currentJobId = null;
let currentJob = null;
let previewRefreshInterval = null;

const elements = {
  totalWorkers: document.getElementById('totalWorkers'),
  completedTiles: document.getElementById('completedTiles'),
  totalTiles: document.getElementById('totalTiles'),
  renderWidth: document.getElementById('renderWidth'),
  renderHeight: document.getElementById('renderHeight'),
  tileSize: document.getElementById('tileSize'),
  samplesPerPixel: document.getElementById('samplesPerPixel'),
  maxBounces: document.getElementById('maxBounces'),
  maxBouncesValue: document.getElementById('maxBouncesValue'),
  startJobBtn: document.getElementById('startJobBtn'),
  totalProgress: document.getElementById('totalProgress'),
  totalProgressFill: document.getElementById('totalProgressFill'),
  tilesContainer: document.getElementById('tilesContainer'),
  tilesGrid: document.getElementById('tilesGrid'),
  emptyState: document.getElementById('emptyState'),
  previewContainer: document.getElementById('previewContainer'),
  previewCanvas: document.getElementById('previewCanvas'),
  previewEmptyState: document.getElementById('previewEmptyState'),
  previewOverlay: document.getElementById('previewOverlay'),
  resolutionBadge: document.getElementById('resolutionBadge'),
  downloadSection: document.getElementById('downloadSection'),
  downloadBtn: document.getElementById('downloadBtn'),
  workersList: document.getElementById('workersList')
};

elements.maxBounces.addEventListener('input', () => {
  elements.maxBouncesValue.textContent = elements.maxBounces.value;
});

elements.startJobBtn.addEventListener('click', startJob);

elements.downloadBtn.addEventListener('click', () => {
  if (currentJobId) {
    window.open(`/api/result/${currentJobId}.png`, '_blank');
  }
});

async function startJob() {
  const width = parseInt(elements.renderWidth.value);
  const height = parseInt(elements.renderHeight.value);
  const tileSize = parseInt(elements.tileSize.value);
  const samplesPerPixel = parseInt(elements.samplesPerPixel.value);
  const maxBounces = parseInt(elements.maxBounces.value);
  const sceneType = document.querySelector('input[name="scene"]:checked').value;
  
  elements.startJobBtn.disabled = true;
  elements.startJobBtn.innerHTML = '<span>⏳</span><span>正在创建任务...</span>';
  
  try {
    const response = await fetch('/api/job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        width,
        height,
        tileSize,
        samplesPerPixel,
        maxBounces,
        sceneType
      })
    });
    
    const data = await response.json();
    currentJobId = data.jobId;
    
    elements.emptyState.style.display = 'none';
    elements.tilesGrid.style.display = 'grid';
    elements.previewEmptyState.style.display = 'none';
    elements.previewCanvas.style.display = 'block';
    elements.previewOverlay.style.display = 'flex';
    elements.downloadSection.style.display = 'flex';
    
    elements.previewCanvas.width = width;
    elements.previewCanvas.height = height;
    elements.resolutionBadge.textContent = `${width} × ${height}`;
    
    createTilesGrid(data.totalTiles, width, height, tileSize);
    
    loadJobStatus();
    startPreviewRefresh();
    
  } catch (err) {
    console.error('Failed to start job:', err);
    alert('创建任务失败: ' + err.message);
  } finally {
    elements.startJobBtn.disabled = false;
    elements.startJobBtn.innerHTML = '<span>🚀</span><span>开始渲染任务</span>';
  }
}

function createTilesGrid(totalTiles, width, height, tileSize) {
  const cols = Math.ceil(width / tileSize);
  const rows = Math.ceil(height / tileSize);
  
  elements.tilesGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  elements.tilesGrid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  elements.tilesGrid.innerHTML = '';
  
  for (let i = 0; i < totalTiles; i++) {
    const cell = document.createElement('div');
    cell.className = 'tile-cell pending';
    cell.dataset.tileIndex = i;
    cell.title = `Tile ${i}`;
    elements.tilesGrid.appendChild(cell);
  }
  
  elements.totalTiles.textContent = totalTiles;
  elements.completedTiles.textContent = '0';
  elements.totalProgress.textContent = '0%';
  elements.totalProgressFill.style.width = '0%';
}

function updateTilesGrid(tiles) {
  const cells = elements.tilesGrid.querySelectorAll('.tile-cell');
  
  tiles.forEach((tile, idx) => {
    const cell = cells[idx];
    if (cell) {
      cell.className = 'tile-cell ' + tile.status;
      
      if (tile.status === 'assigned' && tile.progress) {
        cell.title = `Tile ${idx} - ${tile.progress}%`;
      } else if (tile.status === 'completed' && tile.renderTime) {
        cell.title = `Tile ${idx} - ${(tile.renderTime / 1000).toFixed(1)}s`;
      } else {
        cell.title = `Tile ${idx} - ${tile.status}`;
      }
    }
  });
  
  const completed = tiles.filter(t => t.status === 'completed').length;
  elements.completedTiles.textContent = completed;
  
  const progress = tiles.length > 0 ? Math.floor((completed / tiles.length) * 100) : 0;
  elements.totalProgress.textContent = progress + '%';
  elements.totalProgressFill.style.width = progress + '%';
  
  if (progress === 100 && tiles.length > 0) {
    stopPreviewRefresh();
  }
}

function updateWorkersList(workers) {
  if (workers.length === 0) {
    elements.workersList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔌</div>
        <div>暂无连接的工作节点</div>
      </div>
    `;
    elements.totalWorkers.textContent = '0';
    return;
  }
  
  elements.totalWorkers.textContent = workers.length;
  
  elements.workersList.innerHTML = workers.map(worker => `
    <div class="worker-card">
      <div class="worker-header">
        <span class="worker-id">${worker.id.substring(0, 8)}...</span>
        <div class="worker-status-dot"></div>
      </div>
      <div class="worker-stats">
        <span class="worker-stat-label">CPU 核心</span>
        <span class="worker-stat-value">${worker.cores}</span>
        <span class="worker-stat-label">已完成</span>
        <span class="worker-stat-value">${worker.tilesCompleted} 个</span>
      </div>
    </div>
  `).join('');
}

function updatePreview() {
  if (!currentJobId) return;
  
  const previewImg = new Image();
  previewImg.crossOrigin = 'anonymous';
  previewImg.onload = () => {
    const ctx = elements.previewCanvas.getContext('2d');
    ctx.drawImage(previewImg, 0, 0);
  };
  previewImg.src = `/api/job/${currentJobId}/preview?t=${Date.now()}`;
}

function startPreviewRefresh() {
  stopPreviewRefresh();
  previewRefreshInterval = setInterval(updatePreview, 1000);
}

function stopPreviewRefresh() {
  if (previewRefreshInterval) {
    clearInterval(previewRefreshInterval);
    previewRefreshInterval = null;
  }
}

async function loadJobStatus() {
  if (!currentJobId) return;
  
  try {
    const response = await fetch(`/api/job/${currentJobId}`);
    const status = await response.json();
    currentJob = status;
    
    if (status.tiles) {
      updateTilesGrid(status.tiles);
    }
  } catch (err) {
    console.error('Failed to load job status:', err);
  }
}

async function loadWorkers() {
  try {
    const response = await fetch('/api/workers');
    const workers = await response.json();
    updateWorkersList(workers);
  } catch (err) {
    console.error('Failed to load workers:', err);
  }
}

socket.on('jobStatus', (status) => {
  if (status.jobId === currentJobId && status.tiles) {
    currentJob = status;
    updateTilesGrid(status.tiles);
  }
});

socket.on('workerUpdate', (workers) => {
  updateWorkersList(workers);
});

loadWorkers();
setInterval(loadWorkers, 3000);

window.addEventListener('beforeunload', () => {
  stopPreviewRefresh();
});
