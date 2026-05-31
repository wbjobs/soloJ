const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');
const LifeGrid = require('./life-grid');
const { patterns, placePattern } = require('./patterns');

const MAX_HISTORY = 100;

class HistoryManager {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.snapshots = [];
    this.bufferSize = width * height;
  }

  push(generation, cells) {
    if (this.snapshots.length >= MAX_HISTORY) {
      this.snapshots.shift();
    }
    const copy = new Uint8Array(this.bufferSize);
    copy.set(cells);
    this.snapshots.push({ generation, cells: copy });
  }

  getSnapshotAt(generation) {
    if (this.snapshots.length === 0) return null;
    const oldestGen = this.snapshots[0].generation;
    const relIdx = generation - oldestGen;
    if (relIdx < 0 || relIdx >= this.snapshots.length) return null;
    return this.snapshots[relIdx];
  }

  getOldestGeneration() {
    return this.snapshots.length > 0 ? this.snapshots[0].generation : -1;
  }

  getLatestGeneration() {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1].generation : -1;
  }

  getSize() {
    return this.snapshots.length;
  }

  clear() {
    this.snapshots = [];
  }
}

class LifeEngine {
  constructor(width, height, workerCount = os.cpus().length) {
    this.width = width;
    this.height = height;
    this.workerCount = Math.min(workerCount, height);
    this.grid = new LifeGrid(width, height);
    this.nextGrid = new LifeGrid(width, height);
    this.workers = [];
    this.pendingResults = 0;
    this.workerRegions = [];
    this.evolveCallback = null;
    this.isEvolving = false;
    this.generation = 0;
    this.fps = 0;
    this.lastFpsTime = Date.now();
    this.frameCount = 0;
    this.history = new HistoryManager(width, height);
  }

  async init() {
    const rowsPerWorker = Math.ceil(this.height / this.workerCount);
    
    for (let i = 0; i < this.workerCount; i++) {
      const startY = i * rowsPerWorker;
      const endY = Math.min(startY + rowsPerWorker, this.height);
      
      const workerData = {
        width: this.width,
        height: this.height,
        startY,
        endY
      };

      this.workerRegions.push({ startY, endY });
      
      const worker = new Worker(path.join(__dirname, 'evolution-worker.js'), { workerData });
      
      worker.on('message', (msg) => this.handleWorkerMessage(msg, i));
      worker.on('error', (err) => console.error('Worker error:', err));
      worker.on('exit', (code) => {
        if (code !== 0) console.error(`Worker stopped with exit code ${code}`);
      });

      this.workers.push(worker);
      
      this._sendRegionData(worker, startY, endY);
    }
  }

  handleWorkerMessage(msg, workerIndex) {
    if (msg.type === 'result') {
      const { startY, data } = msg;
      
      this.nextGrid.cells.set(data, startY * this.width);
      
      this.pendingResults--;
      
      if (this.pendingResults === 0) {
        this.completeEvolution();
      }
    }
  }

  evolve(callback) {
    if (this.isEvolving) return;
    
    this.isEvolving = true;
    this.evolveCallback = callback;
    this.pendingResults = this.workerCount;

    const prevWorker = (i) => (i - 1 + this.workerCount) % this.workerCount;
    const nextWorker = (i) => (i + 1) % this.workerCount;

    for (let i = 0; i < this.workerCount; i++) {
      const { startY, endY } = this.workerRegions[i];
      
      const prevIdx = prevWorker(i);
      const nextIdx = nextWorker(i);
      const prevRegion = this.workerRegions[prevIdx];
      const nextRegion = this.workerRegions[nextIdx];

      const topRowSourceY = prevRegion.endY - 1;
      const topRow = new Uint8Array(this.grid.cells.subarray(topRowSourceY * this.width, (topRowSourceY + 1) * this.width));

      const bottomRowSourceY = nextRegion.startY;
      const bottomRow = new Uint8Array(this.grid.cells.subarray(bottomRowSourceY * this.width, (bottomRowSourceY + 1) * this.width));

      this.workers[i].postMessage({ 
        type: 'evolve', 
        topRow, 
        bottomRow 
      });
    }
  }

  completeEvolution() {
    const temp = this.grid;
    this.grid = this.nextGrid;
    this.nextGrid = temp;
    
    this.generation++;
    this.frameCount++;
    
    this.history.push(this.generation, this.grid.cells);
    
    const now = Date.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
    
    this.isEvolving = false;
    
    if (this.evolveCallback) {
      const cb = this.evolveCallback;
      this.evolveCallback = null;
      cb(this.grid, { generation: this.generation, fps: this.fps });
    }
  }

  setCell(x, y, value) {
    this.grid.set(x, y, value);
    
    for (let i = 0; i < this.workerCount; i++) {
      const { startY, endY } = this.workerRegions[i];
      if (y >= startY && y < endY) {
        this.workers[i].postMessage({ type: 'setCell', x, y, value: value ? 1 : 0 });
        break;
      }
    }
  }

  fillRandom(density = 0.3) {
    this.grid.fillRandom(density);
    this._broadcastGridToWorkers();
  }

  clear() {
    this.grid.clear();
    this._broadcastGridToWorkers();
    this.history.clear();
  }

  placePattern(patternName, x, y) {
    placePattern(this.grid, patternName, x, y);
    this._broadcastGridToWorkers();
  }

  loadPattern(patternName) {
    const pattern = patterns[patternName];
    if (!pattern) return false;
    
    this.grid.clear();
    this.generation = 0;
    this.history.clear();
    
    const patternH = pattern.length;
    const patternW = pattern[0].length;
    const cx = Math.floor((this.width - patternW) / 2);
    const cy = Math.floor((this.height - patternH) / 2);
    
    placePattern(this.grid, patternName, cx, cy);
    this._broadcastGridToWorkers();
    return true;
  }

  getHistorySnapshot(generation) {
    return this.history.getSnapshotAt(generation);
  }

  getHistoryRange() {
    return {
      oldest: this.history.getOldestGeneration(),
      latest: this.history.getLatestGeneration(),
      size: this.history.getSize(),
      max: MAX_HISTORY
    };
  }

  _sendRegionData(worker, startY, endY) {
    const regionData = this.grid.cells.subarray(startY * this.width, endY * this.width);
    const copy = new Uint8Array(regionData);
    worker.postMessage({ type: 'setData', data: copy });
  }

  _broadcastGridToWorkers() {
    for (let i = 0; i < this.workerCount; i++) {
      const { startY, endY } = this.workerRegions[i];
      this._sendRegionData(this.workers[i], startY, endY);
    }
  }

  getState() {
    return {
      grid: this.grid,
      generation: this.generation,
      fps: this.fps,
      width: this.width,
      height: this.height
    };
  }

  async shutdown() {
    for (const worker of this.workers) {
      await worker.terminate();
    }
    this.workers = [];
  }
}

module.exports = LifeEngine;
