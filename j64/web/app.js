class GameOfLifeClient {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.ws = null;
    
    this.width = 0;
    this.height = 0;
    this.cells = null;
    this.generation = 0;
    this.serverFps = 0;
    this.isRunning = false;
    
    this.zoom = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.autoFit = true;
    this.cellSize = 1;
    
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.isPainting = false;
    this.paintValue = true;
    
    this.imageData = null;
    this.pixelBuffer = null;
    
    this.renderFps = 0;
    this.lastRenderTime = performance.now();
    this.renderFrameCount = 0;
    
    this.pendingCells = [];
    this.pendingTimeout = null;

    this.HEADER_SIZE = 9;
    
    this.historyOldest = -1;
    this.historyLatest = -1;
    this.historySize = 0;
    this.isReplaying = false;
    this.replayTimer = null;
    this.isLiveMode = true;
    this.replayGeneration = -1;
    
    this.init();
  }

  init() {
    this.setupCanvas();
    this.setupWebSocket();
    this.setupControls();
    this.setupMouse();
    this.loadPatterns();
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }

  setupCanvas() {
    const container = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    
    this.displayWidth = container.clientWidth;
    this.displayHeight = container.clientHeight;
    
    this.canvas.width = this.displayWidth * dpr;
    this.canvas.height = this.displayHeight * dpr;
    this.canvas.style.width = this.displayWidth + 'px';
    this.canvas.style.height = this.displayHeight + 'px';
    
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = false;
  }

  setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';
    
    this.ws.onopen = () => {
      console.log('WebSocket 已连接');
    };
    
    this.ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.handleBinaryMessage(event.data);
      } else {
        try {
          const msg = JSON.parse(event.data);
          this.handleJsonMessage(msg);
        } catch (e) {
          console.error('解析消息失败:', e);
        }
      }
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket 已断开，尝试重连...');
      setTimeout(() => this.setupWebSocket(), 2000);
    };
    
    this.ws.onerror = (err) => {
      console.error('WebSocket 错误:', err);
    };
  }

  handleBinaryMessage(data) {
    const view = new DataView(data);
    const msgType = view.getUint8(0);

    if (msgType === 0x01) {
      const generation = view.getUint32(1);
      const running = view.getUint32(5) === 1;
      const cellsData = new Uint8Array(data, this.HEADER_SIZE);

      if (!this.width) {
        this.width = 1000;
        this.height = 1000;
        this.createImageBuffer();
      }

      if (!this.cells || this.cells.length !== cellsData.length) {
        this.cells = new Uint8Array(cellsData.length);
      }
      this.cells.set(cellsData);
      this.generation = generation;
      this.isRunning = running;
      
      if (this.isLiveMode) {
        this.replayGeneration = generation;
        this.updateHistorySlider();
      }
      
      this.updateStatus();
      this.scheduleRender();
    } else if (msgType === 0x02) {
      const generation = view.getUint32(1);
      const cellsData = new Uint8Array(data, this.HEADER_SIZE);

      if (!this.cells || this.cells.length !== cellsData.length) {
        this.cells = new Uint8Array(cellsData.length);
      }
      this.cells.set(cellsData);
      this.generation = generation;
      this.replayGeneration = generation;
      document.getElementById('history-current').textContent = generation;
      this.updateStatus();
      this.scheduleRender();
    }
  }

  handleJsonMessage(msg) {
    switch (msg.type) {
      case 'status':
        this.isRunning = msg.running;
        this.generation = msg.generation;
        this.serverFps = msg.fps;
        this.updateStatus();
        break;
      case 'historyRange':
        this.historyOldest = msg.oldest;
        this.historyLatest = msg.latest;
        this.historySize = msg.size;
        this.updateHistorySlider();
        break;
    }
  }

  createImageBuffer() {
    this.imageData = this.ctx.createImageData(this.displayWidth, this.displayHeight);
    this.pixelBuffer = new Uint32Array(this.imageData.data.buffer);
  }

  scheduleRender() {
    requestAnimationFrame(() => this.render());
  }

  render() {
    if (!this.cells || !this.pixelBuffer) return;
    
    const now = performance.now();
    this.renderFrameCount++;
    if (now - this.lastRenderTime >= 1000) {
      this.renderFps = this.renderFrameCount;
      this.renderFrameCount = 0;
      this.lastRenderTime = now;
      document.getElementById('render-fps').textContent = this.renderFps;
    }
    
    const w = this.displayWidth;
    const h = this.displayHeight;
    const buffer = this.pixelBuffer;
    const cells = this.cells;
    const gridW = this.width;
    const gridH = this.height;
    
    const zoom = this.zoom;
    const cellSize = this.cellSize * zoom;
    const offsetX = this.offsetX;
    const offsetY = this.offsetY;
    
    const deadColor = 0xFF0A0A0F;
    const aliveColor = 0xFFFFD400;
    
    if (cellSize >= 2) {
      this.renderLargeCells(buffer, cells, gridW, gridH, w, h, cellSize, offsetX, offsetY, deadColor, aliveColor);
    } else {
      this.renderSmallCells(buffer, cells, gridW, gridH, w, h, zoom, offsetX, offsetY, deadColor, aliveColor);
    }
    
    this.ctx.putImageData(this.imageData, 0, 0);
    
    if (cellSize >= 3) {
      this.drawGridLines(w, h, cellSize, offsetX, offsetY);
    }
  }

  renderLargeCells(buffer, cells, gridW, gridH, w, h, cellSize, offsetX, offsetY, deadColor, aliveColor) {
    buffer.fill(deadColor);
    
    const startX = Math.max(0, Math.floor(-offsetX / cellSize));
    const endX = Math.min(gridW, Math.ceil((w - offsetX) / cellSize));
    const startY = Math.max(0, Math.floor(-offsetY / cellSize));
    const endY = Math.min(gridH, Math.ceil((h - offsetY) / cellSize));
    
    const cellSizeFloor = Math.floor(cellSize);
    const gap = cellSize >= 4 ? 1 : 0;
    
    for (let gy = startY; gy < endY; gy++) {
      const rowOffset = gy * gridW;
      const screenY = Math.floor(gy * cellSize + offsetY);
      
      for (let gx = startX; gx < endX; gx++) {
        if (cells[rowOffset + gx]) {
          const screenX = Math.floor(gx * cellSize + offsetX);
          const boxW = cellSizeFloor - gap;
          const boxH = cellSizeFloor - gap;
          
          for (let py = 0; py < boxH; py++) {
            const bufY = screenY + py;
            if (bufY >= 0 && bufY < h) {
              const bufOffset = bufY * w;
              for (let px = 0; px < boxW; px++) {
                const bufX = screenX + px;
                if (bufX >= 0 && bufX < w) {
                  buffer[bufOffset + bufX] = aliveColor;
                }
              }
            }
          }
        }
      }
    }
  }

  renderSmallCells(buffer, cells, gridW, gridH, w, h, zoom, offsetX, offsetY, deadColor, aliveColor) {
    const step = Math.max(1, Math.floor(1 / zoom));
    
    for (let y = 0; y < h; y++) {
      const bufOffset = y * w;
      const gridY = Math.floor((y - offsetY) / zoom);
      
      if (gridY < 0 || gridY >= gridH) {
        for (let x = 0; x < w; x++) {
          buffer[bufOffset + x] = deadColor;
        }
        continue;
      }
      
      const rowOffset = gridY * gridW;
      
      for (let x = 0; x < w; x++) {
        const gridX = Math.floor((x - offsetX) / zoom);
        
        if (gridX >= 0 && gridX < gridW) {
          const sampleX = Math.floor(gridX / step) * step;
          const sampleY = Math.floor(gridY / step) * step;
          const sampleOffset = sampleY * gridW + sampleX;
          
          let alive = false;
          for (let dy = 0; dy < step && !alive; dy++) {
            const sy = sampleY + dy;
            if (sy < gridH) {
              const off = sy * gridW;
              for (let dx = 0; dx < step; dx++) {
                const sx = sampleX + dx;
                if (sx < gridW && cells[off + sx]) {
                  alive = true;
                  break;
                }
              }
            }
          }
          
          buffer[bufOffset + x] = alive ? aliveColor : deadColor;
        } else {
          buffer[bufOffset + x] = deadColor;
        }
      }
    }
  }

  drawGridLines(w, h, cellSize, offsetX, offsetY) {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;
    
    this.ctx.beginPath();
    for (let x = offsetX % cellSize; x < w; x += cellSize) {
      this.ctx.moveTo(x + 0.5, 0);
      this.ctx.lineTo(x + 0.5, h);
    }
    for (let y = offsetY % cellSize; y < h; y += cellSize) {
      this.ctx.moveTo(0, y + 0.5);
      this.ctx.lineTo(w, y + 0.5);
    }
    this.ctx.stroke();
  }

  setupControls() {
    document.getElementById('btn-start').addEventListener('click', () => {
      this.exitReplayMode();
      this.send({ type: 'start' });
    });
    document.getElementById('btn-stop').addEventListener('click', () => this.send({ type: 'stop' }));
    document.getElementById('btn-step').addEventListener('click', () => {
      this.exitReplayMode();
      this.send({ type: 'step', steps: 1 });
    });
    document.getElementById('btn-clear').addEventListener('click', () => {
      this.exitReplayMode();
      this.send({ type: 'clear' });
    });
    document.getElementById('btn-random').addEventListener('click', () => {
      this.exitReplayMode();
      this.send({ type: 'random', density: 0.3 });
    });
    
    document.getElementById('btn-load-pattern').addEventListener('click', () => {
      const select = document.getElementById('pattern-select');
      const name = select.value;
      if (name) {
        this.exitReplayMode();
        this.send({ type: 'loadPattern', name });
      }
    });
    
    document.getElementById('auto-fit').addEventListener('change', (e) => {
      this.autoFit = e.target.checked;
      if (this.autoFit) {
        this.calculateFit();
        this.render();
      }
    });
    
    document.getElementById('zoom').addEventListener('input', (e) => {
      this.zoom = parseFloat(e.target.value);
      this.autoFit = false;
      document.getElementById('auto-fit').checked = false;
      document.getElementById('zoom-value').textContent = this.zoom.toFixed(1);
      this.render();
    });

    const historySlider = document.getElementById('history-slider');
    historySlider.addEventListener('input', (e) => {
      const gen = parseInt(e.target.value, 10);
      if (gen !== this.replayGeneration) {
        this.isLiveMode = false;
        this.replayGeneration = gen;
        document.getElementById('history-current').textContent = gen;
        this.send({ type: 'history', generation: gen });
      }
    });

    document.getElementById('btn-history-play').addEventListener('click', () => {
      this.startReplay();
    });
    document.getElementById('btn-history-stop').addEventListener('click', () => {
      this.stopReplay();
    });
    document.getElementById('btn-history-live').addEventListener('click', () => {
      this.exitReplayMode();
    });
  }

  setupMouse() {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
  }

  handleMouseDown(e) {
    if (e.button === 0) {
      this.isPainting = true;
      this.paintValue = true;
      this.paintCellAt(e);
    } else if (e.button === 2) {
      this.isPainting = true;
      this.paintValue = false;
      this.paintCellAt(e);
    } else if (e.button === 1) {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      e.preventDefault();
    }
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const gridX = Math.floor((x - this.offsetX) / (this.cellSize * this.zoom));
    const gridY = Math.floor((y - this.offsetY) / (this.cellSize * this.zoom));
    document.getElementById('coordinates').textContent = `x: ${gridX}, y: ${gridY}`;
    
    if (this.isDragging) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.offsetX += dx;
      this.offsetY += dy;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.autoFit = false;
      document.getElementById('auto-fit').checked = false;
      this.render();
    } else if (this.isPainting) {
      this.paintCellAt(e);
    }
  }

  handleMouseUp(e) {
    this.isDragging = false;
    this.isPainting = false;
    this.flushPendingCells();
  }

  handleWheel(e) {
    e.preventDefault();
    
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const worldX = (mouseX - this.offsetX) / this.zoom;
    const worldY = (mouseY - this.offsetY) / this.zoom;
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoom = Math.max(0.1, Math.min(5, this.zoom * delta));
    
    this.offsetX = mouseX - worldX * this.zoom;
    this.offsetY = mouseY - worldY * this.zoom;
    
    this.autoFit = false;
    document.getElementById('auto-fit').checked = false;
    document.getElementById('zoom').value = this.zoom;
    document.getElementById('zoom-value').textContent = this.zoom.toFixed(1);
    
    this.render();
  }

  paintCellAt(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const gridX = Math.floor((x - this.offsetX) / (this.cellSize * this.zoom));
    const gridY = Math.floor((y - this.offsetY) / (this.cellSize * this.zoom));
    
    if (gridX >= 0 && gridX < this.width && gridY >= 0 && gridY < this.height) {
      const idx = gridY * this.width + gridX;
      if (this.cells[idx] !== (this.paintValue ? 1 : 0)) {
        this.cells[idx] = this.paintValue ? 1 : 0;
        this.queueCellUpdate(gridX, gridY, this.paintValue);
        this.render();
      }
    }
  }

  queueCellUpdate(x, y, value) {
    this.pendingCells.push({ x, y, value });
    
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
    }
    
    this.pendingTimeout = setTimeout(() => {
      this.flushPendingCells();
    }, 16);
  }

  flushPendingCells() {
    if (this.pendingCells.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'setCells',
        cells: this.pendingCells
      });
      this.pendingCells = [];
    }
    this.pendingTimeout = null;
  }

  handleResize() {
    this.setupCanvas();
    this.createImageBuffer();
    
    if (this.autoFit && this.width > 0) {
      this.calculateFit();
    }
    
    this.render();
  }

  calculateFit() {
    const scaleX = this.displayWidth / this.width;
    const scaleY = this.displayHeight / this.height;
    this.zoom = Math.min(scaleX, scaleY);
    this.cellSize = 1;
    
    this.offsetX = (this.displayWidth - this.width * this.zoom) / 2;
    this.offsetY = (this.displayHeight - this.height * this.zoom) / 2;
    
    document.getElementById('zoom').value = this.zoom;
    document.getElementById('zoom-value').textContent = this.zoom.toFixed(1);
  }

  async loadPatterns() {
    try {
      const response = await fetch('/api/config');
      const config = await response.json();
      
      const select = document.getElementById('pattern-select');
      const patternList = document.getElementById('pattern-list');
      const patternInfo = config.patterns || {};
      const patternNames = Object.keys(patternInfo);

      const displayNames = {
        glider: '🚀 滑翔机',
        blinker: '💫 闪光灯',
        toad: '🐸 蟾蜍',
        beacon: '🚨 信标',
        pulsar: '⭐ 脉冲星',
        gliderGun: '🔫 滑翔机枪',
        lwss: '🛸 轻量飞船',
        rpentomino: '🔤 R-五连块',
        diehard: '💀 顽固种子',
        acorn: '🌰 橡子',
        pentadecathlon: '🕐 十五连',
        block: '🟦 方块',
        beehive: '🐝 蜂巢',
        loaf: '🍞 面包'
      };
      
      const categories = {
        '振荡器': ['blinker', 'toad', 'beacon', 'pulsar', 'pentadecathlon'],
        '飞船': ['glider', 'lwss'],
        '静物': ['block', 'beehive', 'loaf'],
        '混沌': ['rpentomino', 'diehard', 'acorn'],
        '枪': ['gliderGun']
      };
      
      for (const [category, names] of Object.entries(categories)) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = category;
        for (const name of names) {
          if (patternInfo[name]) {
            const opt = document.createElement('option');
            opt.value = name;
            const info = patternInfo[name];
            opt.textContent = (displayNames[name] || name) + ' (' + info.width + '×' + info.height + ')';
            optgroup.appendChild(opt);
          }
        }
        select.appendChild(optgroup);
      }
      
      patternNames.forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'pattern-btn';
        const info = patternInfo[name];
        btn.textContent = (displayNames[name] || name) + ' (' + (info ? info.width + '×' + info.height : '') + ')';
        btn.addEventListener('click', () => {
          select.value = name;
          this.exitReplayMode();
          this.send({ type: 'loadPattern', name });
        });
        patternList.appendChild(btn);
      });
    } catch (e) {
      console.error('加载图案失败:', e);
    }
  }

  updateStatus() {
    document.getElementById('generation').textContent = this.generation.toLocaleString();
    document.getElementById('server-fps').textContent = this.serverFps;
    
    const statusEl = document.getElementById('status');
    if (this.isReplaying) {
      statusEl.textContent = '回放中';
      statusEl.className = 'value status-replay';
    } else if (this.isRunning) {
      statusEl.textContent = '运行中';
      statusEl.className = 'value status-running';
    } else {
      statusEl.textContent = '已停止';
      statusEl.className = 'value status-stopped';
    }
  }

  updateHistorySlider() {
    const slider = document.getElementById('history-slider');
    const currentEl = document.getElementById('history-current');
    const latestEl = document.getElementById('history-latest');
    
    if (this.historyOldest >= 0 && this.historyLatest >= 0) {
      slider.min = this.historyOldest;
      slider.max = this.historyLatest;
      latestEl.textContent = this.historyLatest;
      
      if (this.isLiveMode) {
        slider.value = this.historyLatest;
        currentEl.textContent = this.historyLatest;
      }
    }
  }

  startReplay() {
    if (this.historySize === 0) return;
    this.stopReplay();
    this.isReplaying = true;
    this.isLiveMode = false;
    this.send({ type: 'stop' });
    this.updateStatus();
    
    const startGen = Math.max(this.historyOldest, this.replayGeneration < this.historyOldest ? this.historyOldest : this.replayGeneration);
    this.replayGeneration = startGen;
    
    const replayStep = () => {
      if (!this.isReplaying) return;
      if (this.replayGeneration > this.historyLatest) {
        this.stopReplay();
        return;
      }
      
      this.send({ type: 'history', generation: this.replayGeneration });
      document.getElementById('history-slider').value = this.replayGeneration;
      document.getElementById('history-current').textContent = this.replayGeneration;
      this.replayGeneration++;
      
      this.replayTimer = setTimeout(replayStep, 33);
    };
    
    replayStep();
  }

  stopReplay() {
    this.isReplaying = false;
    if (this.replayTimer) {
      clearTimeout(this.replayTimer);
      this.replayTimer = null;
    }
    this.updateStatus();
  }

  exitReplayMode() {
    this.stopReplay();
    this.isLiveMode = true;
    this.replayGeneration = this.historyLatest;
    this.updateHistorySlider();
    this.updateStatus();
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.game = new GameOfLifeClient();
});
