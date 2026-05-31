const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PNG } = require('pngjs');
const path = require('path');
const fs = require('fs');

const MOCK_CITIES = [
  { name: '北京', country: '中国', lat: 39.9042, lng: 116.4074, tz: 'Asia/Shanghai' },
  { name: '上海', country: '中国', lat: 31.2304, lng: 121.4737, tz: 'Asia/Shanghai' },
  { name: '深圳', country: '中国', lat: 22.5431, lng: 114.0579, tz: 'Asia/Shanghai' },
  { name: '东京', country: '日本', lat: 35.6762, lng: 139.6503, tz: 'Asia/Tokyo' },
  { name: '首尔', country: '韩国', lat: 37.5665, lng: 126.9780, tz: 'Asia/Seoul' },
  { name: '新加坡', country: '新加坡', lat: 1.3521, lng: 103.8198, tz: 'Asia/Singapore' },
  { name: '孟买', country: '印度', lat: 19.0760, lng: 72.8777, tz: 'Asia/Kolkata' },
  { name: '迪拜', country: '阿联酋', lat: 25.2048, lng: 55.2708, tz: 'Asia/Dubai' },
  { name: '莫斯科', country: '俄罗斯', lat: 55.7558, lng: 37.6173, tz: 'Europe/Moscow' },
  { name: '伦敦', country: '英国', lat: 51.5074, lng: -0.1278, tz: 'Europe/London' },
  { name: '巴黎', country: '法国', lat: 48.8566, lng: 2.3522, tz: 'Europe/Paris' },
  { name: '柏林', country: '德国', lat: 52.5200, lng: 13.4050, tz: 'Europe/Berlin' },
  { name: '阿姆斯特丹', country: '荷兰', lat: 52.3676, lng: 4.9041, tz: 'Europe/Amsterdam' },
  { name: '纽约', country: '美国', lat: 40.7128, lng: -74.0060, tz: 'America/New_York' },
  { name: '旧金山', country: '美国', lat: 37.7749, lng: -122.4194, tz: 'America/Los_Angeles' },
  { name: '西雅图', country: '美国', lat: 47.6062, lng: -122.3321, tz: 'America/Los_Angeles' },
  { name: '多伦多', country: '加拿大', lat: 43.6532, lng: -79.3832, tz: 'America/Toronto' },
  { name: '悉尼', country: '澳大利亚', lat: -33.8688, lng: 151.2093, tz: 'Australia/Sydney' },
  { name: '圣保罗', country: '巴西', lat: -23.5505, lng: -46.6333, tz: 'America/Sao_Paulo' },
  { name: '开罗', country: '埃及', lat: 30.0444, lng: 31.2357, tz: 'Africa/Cairo' },
  { name: '约翰内斯堡', country: '南非', lat: -26.2041, lng: 28.0473, tz: 'Africa/Johannesburg' },
  { name: '香港', country: '中国', lat: 22.3193, lng: 114.1694, tz: 'Asia/Hong_Kong' },
  { name: '杭州', country: '中国', lat: 30.2741, lng: 120.1551, tz: 'Asia/Shanghai' },
  { name: '成都', country: '中国', lat: 30.5728, lng: 104.0668, tz: 'Asia/Shanghai' },
  { name: '广州', country: '中国', lat: 23.1291, lng: 113.2644, tz: 'Asia/Shanghai' }
];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getClientIp(socket) {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return socket.handshake.address;
}

async function geoLocateIp(ip) {
  try {
    const resp = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN&fields=status,country,city,lat,lon,timezone,query`, {
      signal: AbortSignal.timeout(3000)
    });
    const data = await resp.json();
    if (data.status === 'success') {
      return {
        city: data.city,
        country: data.country,
        lat: data.lat,
        lng: data.lon,
        timezone: data.timezone,
        ip: data.query,
        source: 'real'
      };
    }
  } catch (e) {
  }
  
  const hash = hashCode(ip || '127.0.0.1');
  const city = MOCK_CITIES[hash % MOCK_CITIES.length];
  const jitterLat = ((hash % 100) / 1000) - 0.05;
  const jitterLng = (((hash >> 8) % 100) / 1000) - 0.05;
  
  return {
    city: city.name,
    country: city.country,
    lat: city.lat + jitterLat,
    lng: city.lng + jitterLng,
    timezone: city.tz,
    ip: ip || '127.0.0.1',
    source: 'mock'
  };
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 120000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const TILE_TIMEOUT_ACTIVE = 180000;
const TILE_TIMEOUT_BACKGROUND = 600000;
const HEARTBEAT_TIMEOUT = 120000;
const TIMEOUT_CHECK_INTERVAL = 30000;

const jobs = new Map();
const tilesByJob = new Map();
const pendingTiles = new Map();
const workers = new Map();
const pixelBuffers = new Map();
const completedTileVersions = new Map();
const rowWrittenFlags = new Map();

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function splitIntoTiles(width, height, tileSize) {
  const tiles = [];
  for (let y = 0; y < height; y += tileSize) {
    for (let x = 0; x < width; x += tileSize) {
      const tileWidth = Math.min(tileSize, width - x);
      const tileHeight = Math.min(tileSize, height - y);
      tiles.push({
        x,
        y,
        width: tileWidth,
        height: tileHeight
      });
    }
  }
  return tiles;
}

function getJobStatus(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  
  const tiles = tilesByJob.get(jobId);
  const tilesArray = Array.from(tiles.values());
  const completedTiles = tilesArray.filter(t => t.status === 'completed').length;
  const assignedTiles = tilesArray.filter(t => t.status === 'assigned').length;
  
  return {
    jobId,
    params: job.params,
    scene: job.scene,
    totalTiles: tilesArray.length,
    completedTiles,
    assignedTiles,
    activeWorkers: workers.size,
    status: job.status,
    tiles: tilesArray.map(t => ({
      id: t.id,
      x: t.x,
      y: t.y,
      width: t.width,
      height: t.height,
      status: t.status,
      workerId: t.workerId,
      progress: t.progress || 0,
      renderTime: t.renderTime
    }))
  };
}

function broadcastJobStatus(jobId) {
  const status = getJobStatus(jobId);
  if (status) {
    io.emit('jobStatus', status);
  }
}

function parseTileId(tileId) {
  const idx = tileId.lastIndexOf('_');
  if (idx === -1) return { jobId: tileId, tileIndex: -1 };
  return { jobId: tileId.substring(0, idx), tileIndex: parseInt(tileId.substring(idx + 1), 10) };
}

function reassignTile(tileId, jobId) {
  const tile = tilesByJob.get(jobId)?.get(tileId);
  if (!tile || tile.status !== 'assigned') return;
  
  tile.status = 'pending';
  tile.workerId = null;
  tile.progress = 0;
  tile.version = (tile.version || 0) + 1;
  
  const pending = pendingTiles.get(jobId);
  if (pending) {
    pending.unshift(tileId);
  }
  
  console.log(`Tile ${tileId} reassigned (timed out or worker gone), version now ${tile.version}`);
  broadcastJobStatus(jobId);
}

function initJobBuffers(jobId, width, height) {
  const bufferSize = width * height * 4;
  pixelBuffers.set(jobId, new Uint8ClampedArray(bufferSize));
  completedTileVersions.set(jobId, new Map());
  rowWrittenFlags.set(jobId, new Uint8Array(height));
}

function markTileRowsWritten(jobId, tileY, tileH) {
  const flags = rowWrittenFlags.get(jobId);
  if (!flags) return;
  for (let dy = 0; dy < tileH; dy++) {
    flags[tileY + dy] = 1;
  }
}

function snapshotVisibleBuffer(jobId, width, height) {
  const buffer = pixelBuffers.get(jobId);
  const rowFlags = rowWrittenFlags.get(jobId);
  if (!buffer) return null;
  
  const snap = Buffer.alloc(buffer.length);
  if (rowFlags) {
    const fullRowBytes = width * 4;
    for (let row = 0; row < height; row++) {
      if (rowFlags[row]) {
        const srcStart = row * fullRowBytes;
        const srcEnd = srcStart + fullRowBytes;
        snap.set(buffer.subarray(srcStart, srcEnd), srcStart);
      } else {
        for (let col = 0; col < width; col++) {
          const idx = (row * width + col) * 4;
          snap[idx] = 20;
          snap[idx + 1] = 30;
          snap[idx + 2] = 48;
          snap[idx + 3] = 255;
        }
      }
    }
  } else {
    snap.set(buffer);
  }
  return snap;
}

function assemblePNG(jobId) {
  const job = jobs.get(jobId);
  if (!job || job.status !== 'completed') return null;
  
  const { width, height } = job.params;
  const snapshot = snapshotVisibleBuffer(jobId, width, height);
  if (!snapshot) return null;
  
  const png = new PNG({ width, height });
  png.data = snapshot;
  
  const outPath = path.join(__dirname, 'results', `${jobId}.png`);
  if (!fs.existsSync(path.join(__dirname, 'results'))) {
    fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  }
  
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(outPath);
    png.pack().pipe(stream);
    stream.on('finish', () => resolve(outPath));
    stream.on('error', reject);
  });
}

setInterval(() => {
  const now = Date.now();
  
  for (const [jobId, tileMap] of tilesByJob) {
    const job = jobs.get(jobId);
    if (!job || job.status !== 'running') continue;
    
    for (const [tileId, tile] of tileMap) {
      if (tile.status !== 'assigned') continue;
      
      const worker = workers.get(tile.workerId);
      if (!worker) {
        reassignTile(tileId, jobId);
        continue;
      }
      
      const isBackground = worker.isBackground || false;
      const timeout = isBackground ? TILE_TIMEOUT_BACKGROUND : TILE_TIMEOUT_ACTIVE;
      
      const lastActivity = Math.max(
        tile.assignedAt || 0,
        worker.lastHeartbeat || 0,
        worker.lastSeen || 0
      );
      
      if (now - lastActivity > timeout) {
        reassignTile(tileId, jobId);
      }
    }
  }
}, TIMEOUT_CHECK_INTERVAL);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/worker', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'worker.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.post('/api/job', (req, res) => {
  const { width, height, tileSize = 128, samplesPerPixel = 4, maxBounces = 3, sceneType = 'cornell' } = req.body;
  
  const jobId = generateId();
  const tileConfigs = splitIntoTiles(width, height, tileSize);
  
  const job = {
    id: jobId,
    params: { width, height, samplesPerPixel, maxBounces },
    scene: {
      type: sceneType,
      camera: {
        eye: [0, 0.5, -3.5],
        lookAt: [0, 0.5, 0],
        fov: 45
      }
    },
    status: 'running',
    createdAt: Date.now()
  };
  
  jobs.set(jobId, job);
  
  const tileMap = new Map();
  const pendingIds = [];
  
  tileConfigs.forEach((config, idx) => {
    const tileId = `${jobId}_${idx}`;
    const tile = {
      id: tileId,
      jobId,
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      status: 'pending',
      progress: 0,
      version: 0
    };
    tileMap.set(tileId, tile);
    pendingIds.push(tileId);
  });
  
  tilesByJob.set(jobId, tileMap);
  pendingTiles.set(jobId, pendingIds);
  initJobBuffers(jobId, width, height);
  
  res.json({ jobId, totalTiles: tileConfigs.length });
  
  setTimeout(() => broadcastJobStatus(jobId), 100);
});

app.get('/api/job/:jobId', (req, res) => {
  const status = getJobStatus(req.params.jobId);
  if (!status) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(status);
});

app.get('/api/job/:jobId/preview', (req, res) => {
  const jobId = req.params.jobId;
  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  const { width, height } = job.params;
  const snapshot = snapshotVisibleBuffer(jobId, width, height);
  if (!snapshot) {
    return res.status(404).json({ error: 'No buffer' });
  }
  
  const png = new PNG({ width, height });
  png.data = snapshot;
  
  res.setHeader('Content-Type', 'image/png');
  png.pack().pipe(res);
});

app.get('/api/result/:jobId.png', async (req, res) => {
  const jobId = req.params.jobId;
  const job = jobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  try {
    const filePath = await assemblePNG(jobId);
    res.download(filePath, `render_${jobId}.png`);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

app.get('/api/workers', (req, res) => {
  const workersList = Array.from(workers.values()).map(w => ({
    id: w.id,
    cores: w.cores,
    tilesCompleted: w.tilesCompleted,
    totalRenderTime: w.totalRenderTime,
    currentTileId: w.currentTileId,
    lastSeen: w.lastSeen,
    isBackground: w.isBackground,
    location: w.location,
    ip: w.ip
  }));
  res.json(workersList);
});

app.get('/api/global-stats', (req, res) => {
  const workersList = Array.from(workers.values());
  
  const totalCores = workersList.reduce((sum, w) => sum + w.cores, 0);
  const totalTiles = workersList.reduce((sum, w) => sum + w.tilesCompleted, 0);
  const totalRenderTime = workersList.reduce((sum, w) => sum + w.totalRenderTime, 0);
  const activeWorkers = workersList.length;
  const backgroundWorkers = workersList.filter(w => w.isBackground).length;
  
  let jobsRunning = 0;
  let jobsCompleted = 0;
  let totalTilesAllTime = 0;
  let completedTilesAllTime = 0;
  
  for (const job of jobs.values()) {
    if (job.status === 'running') jobsRunning++;
    if (job.status === 'completed') jobsCompleted++;
    const tiles = tilesByJob.get(job.id);
    if (tiles) {
      const tilesArray = Array.from(tiles.values());
      totalTilesAllTime += tilesArray.length;
      completedTilesAllTime += tilesArray.filter(t => t.status === 'completed').length;
    }
  }
  
  const workerLocations = workersList.map(w => ({
    id: w.id,
    cores: w.cores,
    tilesCompleted: w.tilesCompleted,
    totalRenderTime: w.totalRenderTime,
    isBackground: w.isBackground,
    currentTileId: w.currentTileId,
    location: w.location,
    joinedAt: w.joinedAt,
    lastSeen: w.lastSeen
  }));
  
  res.json({
    timestamp: Date.now(),
    totalCores,
    totalTiles,
    totalRenderTime,
    activeWorkers,
    backgroundWorkers,
    jobsRunning,
    jobsCompleted,
    totalTilesAllTime,
    completedTilesAllTime,
    workers: workerLocations
  });
});

function broadcastGlobalStats() {
  const workersList = Array.from(workers.values());
  
  const totalCores = workersList.reduce((sum, w) => sum + w.cores, 0);
  const totalTiles = workersList.reduce((sum, w) => sum + w.tilesCompleted, 0);
  const totalRenderTime = workersList.reduce((sum, w) => sum + w.totalRenderTime, 0);
  const activeWorkers = workersList.length;
  const backgroundWorkers = workersList.filter(w => w.isBackground).length;
  
  const workerLocations = workersList.map(w => ({
    id: w.id,
    cores: w.cores,
    tilesCompleted: w.tilesCompleted,
    totalRenderTime: w.totalRenderTime,
    isBackground: w.isBackground,
    currentTileId: w.currentTileId,
    location: w.location,
    lastSeen: w.lastSeen
  }));
  
  io.emit('globalStats', {
    timestamp: Date.now(),
    totalCores,
    totalTiles,
    totalRenderTime,
    activeWorkers,
    backgroundWorkers,
    workers: workerLocations
  });
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('workerJoin', async ({ workerId, cores }) => {
    const ip = getClientIp(socket);
    const location = await geoLocateIp(ip);
    
    const worker = {
      id: workerId,
      socketId: socket.id,
      cores: cores || 1,
      tilesCompleted: 0,
      totalRenderTime: 0,
      currentTileId: null,
      lastSeen: Date.now(),
      lastHeartbeat: Date.now(),
      isBackground: false,
      ip,
      location,
      joinedAt: Date.now()
    };
    workers.set(workerId, worker);
    console.log('Worker joined:', workerId, 'from:', location.city, location.country, 'cores:', cores);
    
    io.emit('workerUpdate', Array.from(workers.values()).map(w => ({
      id: w.id,
      cores: w.cores,
      tilesCompleted: w.tilesCompleted,
      isBackground: w.isBackground,
      location: w.location
    })));
    
    broadcastGlobalStats();
  });
  
  socket.on('requestTask', ({ workerId }) => {
    const worker = workers.get(workerId);
    if (!worker) return;
    
    worker.lastSeen = Date.now();
    worker.lastHeartbeat = Date.now();
    
    let assigned = false;
    for (const [jobId, pendingIds] of pendingTiles) {
      const job = jobs.get(jobId);
      if (!job || job.status !== 'running') continue;
      
      if (pendingIds.length > 0) {
        const tileId = pendingIds.shift();
        const tile = tilesByJob.get(jobId).get(tileId);
        
        if (tile && job) {
          tile.status = 'assigned';
          tile.workerId = workerId;
          tile.assignedAt = Date.now();
          tile.version = (tile.version || 0) + 1;
          worker.currentTileId = tileId;
          
          socket.emit('taskAssigned', {
            tileId: tile.id,
            x: tile.x,
            y: tile.y,
            width: tile.width,
            height: tile.height,
            scene: job.scene,
            renderParams: job.params,
            version: tile.version
          });
          
          assigned = true;
          broadcastJobStatus(jobId);
          break;
        }
      }
    }
    
    if (!assigned) {
      socket.emit('noTaskAvailable');
    }
  });
  
  socket.on('heartbeat', ({ workerId, tileId, progress, isBackground }) => {
    const worker = workers.get(workerId);
    if (!worker) return;
    
    worker.lastSeen = Date.now();
    worker.lastHeartbeat = Date.now();
    if (typeof isBackground === 'boolean') {
      worker.isBackground = isBackground;
    }
    
    if (tileId) {
      const { jobId } = parseTileId(tileId);
      const tile = tilesByJob.get(jobId)?.get(tileId);
      if (tile && tile.status === 'assigned' && tile.workerId === workerId) {
        if (typeof progress === 'number') {
          tile.progress = progress;
        }
        broadcastJobStatus(jobId);
      }
    }
  });
  
  socket.on('visibilityChange', ({ workerId, isBackground }) => {
    const worker = workers.get(workerId);
    if (!worker) return;
    
    const wasBackground = worker.isBackground;
    worker.isBackground = isBackground;
    worker.lastSeen = Date.now();
    worker.lastHeartbeat = Date.now();
    
    if (wasBackground !== isBackground) {
      console.log(`Worker ${workerId} ${isBackground ? 'moved to background' : 'returned to foreground'}`);
      
      io.emit('workerUpdate', Array.from(workers.values()).map(w => ({
        id: w.id,
        cores: w.cores,
        tilesCompleted: w.tilesCompleted,
        isBackground: w.isBackground
      })));
    }
  });
  
  socket.on('workerStatus', ({ workerId, tileId, progress }) => {
    const worker = workers.get(workerId);
    if (!worker) return;
    
    worker.lastSeen = Date.now();
    worker.lastHeartbeat = Date.now();
    
    if (tileId) {
      const { jobId } = parseTileId(tileId);
      const tile = tilesByJob.get(jobId)?.get(tileId);
      if (tile && tile.status === 'assigned' && tile.workerId === workerId) {
        tile.progress = progress;
        broadcastJobStatus(jobId);
      }
    }
  });
  
  socket.on('submitTile', ({ workerId, tileId, pixelData, renderTime, version }) => {
    const worker = workers.get(workerId);
    if (!worker) return;
    
    const { jobId } = parseTileId(tileId);
    
    const job = jobs.get(jobId);
    const tile = tilesByJob.get(jobId)?.get(tileId);
    const buffer = pixelBuffers.get(jobId);
    const completedMap = completedTileVersions.get(jobId);
    
    if (!job || !tile || !buffer) {
      socket.emit('tileRejected', { tileId, reason: 'not_found' });
      return;
    }
    
    if (completedMap && completedMap.has(tileId)) {
      console.log(`Tile ${tileId} already completed, rejecting duplicate submission from ${workerId}`);
      socket.emit('tileRejected', { tileId, reason: 'already_completed' });
      
      worker.currentTileId = null;
      worker.lastSeen = Date.now();
      worker.lastHeartbeat = Date.now();
      return;
    }
    
    if (tile.status !== 'assigned') {
      console.log(`Tile ${tileId} status is '${tile.status}', rejecting from ${workerId}`);
      socket.emit('tileRejected', { tileId, reason: 'not_assigned' });
      return;
    }
    
    if (tile.workerId !== workerId) {
      console.log(`Tile ${tileId} assigned to ${tile.workerId}, not ${workerId}, rejecting`);
      socket.emit('tileRejected', { tileId, reason: 'wrong_worker' });
      return;
    }
    
    if (typeof version === 'number' && version !== tile.version) {
      console.log(`Tile ${tileId} version mismatch: expected ${tile.version}, got ${version}, rejecting stale submission from ${workerId}`);
      socket.emit('tileRejected', { tileId, reason: 'stale_version' });
      
      worker.currentTileId = null;
      worker.lastSeen = Date.now();
      return;
    }
    
    const { width: fullWidth } = job.params;
    const { x: tileX, y: tileY, width: tileW, height: tileH } = tile;
    
    const expectedLength = tileW * tileH * 4;
    if (!pixelData || pixelData.length !== expectedLength) {
      console.log(`Tile ${tileId} pixel data length mismatch: expected ${expectedLength}, got ${pixelData?.length}`);
      socket.emit('tileRejected', { tileId, reason: 'invalid_data_length' });
      return;
    }
    
    const rowBytes = tileW * 4;
    const fullRowBytes = fullWidth * 4;
    for (let py = 0; py < tileH; py++) {
      const srcOffset = py * rowBytes;
      const dstOffset = (tileY + py) * fullRowBytes + tileX * 4;
      
      for (let i = 0; i < rowBytes; i++) {
        buffer[dstOffset + i] = pixelData[srcOffset + i];
      }
    }
    
    markTileRowsWritten(jobId, tileY, tileH);
    
    tile.status = 'completed';
    tile.renderTime = renderTime;
    tile.progress = 100;
    
    if (completedMap) {
      completedMap.set(tileId, tile.version);
    }
    
    worker.tilesCompleted++;
    worker.totalRenderTime += renderTime;
    worker.currentTileId = null;
    worker.lastSeen = Date.now();
    worker.lastHeartbeat = Date.now();
    
    const allTiles = tilesByJob.get(jobId);
    const allCompleted = Array.from(allTiles.values()).every(t => t.status === 'completed');
    
    if (allCompleted) {
      job.status = 'completed';
      job.completedAt = Date.now();
      console.log(`Job ${jobId} completed!`);
    }
    
    broadcastJobStatus(jobId);
    
    io.emit('workerUpdate', Array.from(workers.values()).map(w => ({
      id: w.id,
      cores: w.cores,
      tilesCompleted: w.tilesCompleted,
      isBackground: w.isBackground,
      location: w.location
    })));
    
    broadcastGlobalStats();
  });
  
  socket.on('disconnect', () => {
    for (const [workerId, worker] of workers) {
      if (worker.socketId === socket.id) {
        if (worker.currentTileId) {
          const { jobId } = parseTileId(worker.currentTileId);
          const tile = tilesByJob.get(jobId)?.get(worker.currentTileId);
          if (tile && tile.status === 'assigned') {
            tile.version = (tile.version || 0) + 1;
            reassignTile(worker.currentTileId, jobId);
          }
        }
        workers.delete(workerId);
        console.log('Worker disconnected:', workerId);
        
        io.emit('workerUpdate', Array.from(workers.values()).map(w => ({
          id: w.id,
          cores: w.cores,
          tilesCompleted: w.tilesCompleted,
          isBackground: w.isBackground,
          location: w.location
        })));
        break;
      }
    }
    broadcastGlobalStats();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}`);
  console.log(`Worker node: http://localhost:${PORT}/worker`);
});
