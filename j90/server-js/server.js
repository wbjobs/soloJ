const { World, BLOCK, CHUNK_SIZE } = require('./world');
const {
  saveSnapshotSync,
  loadSnapshotSync,
  listSnapshots,
  getSnapshotSize,
  SNAPSHOT_INTERVAL,
  MAX_SNAPSHOTS,
} = require('./snapshot');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const url = require('url');

const world = new World();
const players = new Map();
let playerIdCounter = 0;
let snapshotTimer = null;

const MSG = {
  INIT: 'init',
  PLAYER_JOIN: 'player_join',
  PLAYER_LEAVE: 'player_leave',
  PLAYER_MOVE: 'player_move',
  BLOCK_CHANGE: 'block_change',
  BLOCK_CHANGE_ACK: 'block_change_ack',
  WORLD_ROLLBACK: 'world_rollback',
};

const blockMutex = { locked: false, queue: [] };

async function acquireBlockLock() {
  if (!blockMutex.locked) {
    blockMutex.locked = true;
    return;
  }
  await new Promise(resolve => blockMutex.queue.push(resolve));
  blockMutex.locked = true;
}

function releaseBlockLock() {
  blockMutex.locked = false;
  if (blockMutex.queue.length > 0) {
    const resolve = blockMutex.queue.shift();
    resolve();
  }
}

function generatePlayerId() {
  playerIdCounter++;
  return `player_${playerIdCounter}`;
}

function broadcast(msg, excludeId = null) {
  const data = JSON.stringify(msg);
  for (const [id, player] of players) {
    if (id === excludeId) continue;
    if (player.ws.readyState === 1) {
      player.ws.send(data);
    }
  }
}

function sendToPlayer(player, msg) {
  if (player.ws.readyState === 1) {
    player.ws.send(JSON.stringify(msg));
  }
}

function handleConnection(ws) {
  const playerId = generatePlayerId();
  const player = {
    id: playerId,
    ws: ws,
    x: 0,
    y: 20,
    z: 0,
    rx: 0,
    ry: 0,
  };
  players.set(playerId, player);

  const existingPlayers = [];
  for (const [id, p] of players) {
    if (id !== playerId) {
      existingPlayers.push({ id: p.id, x: p.x, y: p.y, z: p.z, rx: p.rx, ry: p.ry });
    }
  }

  sendToPlayer(player, {
    type: MSG.INIT,
    data: {
      player_id: playerId,
      world: { chunks: world.getAllChunkData() },
      players: existingPlayers,
    },
  });

  broadcast({
    type: MSG.PLAYER_JOIN,
    data: { id: playerId, x: player.x, y: player.y, z: player.z },
  }, playerId);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleMessage(playerId, msg);
    } catch (e) {}
  });

  ws.on('close', () => {
    players.delete(playerId);
    broadcast({ type: MSG.PLAYER_LEAVE, data: { id: playerId } });
  });
}

function handleMessage(playerId, msg) {
  const player = players.get(playerId);
  if (!player) return;

  switch (msg.type) {
    case MSG.PLAYER_MOVE: {
      const d = msg.data;
      player.x = d.x;
      player.y = d.y;
      player.z = d.z;
      player.rx = d.rx || 0;
      player.ry = d.ry || 0;
      broadcast({
        type: MSG.PLAYER_MOVE,
        data: { id: playerId, x: d.x, y: d.y, z: d.z, rx: d.rx || 0, ry: d.ry || 0 },
      }, playerId);
      break;
    }
    case MSG.BLOCK_CHANGE: {
      handleBlockChange(playerId, msg.data);
      break;
    }
  }
}

async function handleBlockChange(playerId, data) {
  const player = players.get(playerId);
  if (!player) return;

  const { x, y, z, block } = data;
  const reqId = data.req_id || Date.now() + '_' + Math.random();

  await acquireBlockLock();
  try {
    const currentBlock = world.getBlock(x, y, z);
    
    if (currentBlock === block) {
      sendToPlayer(player, {
        type: MSG.BLOCK_CHANGE_ACK,
        data: { x, y, z, block, req_id: reqId, applied: false, reason: 'already_same' },
      });
      return;
    }

    world.setBlock(x, y, z, block);

    const appliedBlock = world.getBlock(x, y, z);

    sendToPlayer(player, {
      type: MSG.BLOCK_CHANGE_ACK,
      data: { x, y, z, block: appliedBlock, req_id: reqId, applied: true },
    });

    broadcast({
      type: MSG.BLOCK_CHANGE,
      data: { x, y, z, block: appliedBlock, author_id: playerId },
    }, playerId);
  } finally {
    releaseBlockLock();
  }
}

function rollbackWorld(timestamp) {
  return new Promise((resolve, reject) => {
    acquireBlockLock().then(() => {
      try {
        loadSnapshotSync(timestamp, world);
        
        const rollbackMsg = {
          type: MSG.WORLD_ROLLBACK,
          data: {
            timestamp,
            chunks: world.getAllChunkData(),
          },
        };
        const rollbackData = JSON.stringify(rollbackMsg);

        for (const [id, player] of players) {
          if (player.ws.readyState === 1) {
            player.ws.send(rollbackData);
          }
        }

        console.log(`World rolled back to ${timestamp}, notified ${players.size} players`);
        resolve(true);
      } catch (e) {
        reject(e);
      } finally {
        releaseBlockLock();
      }
    });
  });
}

function createSnapshotNow() {
  acquireBlockLock().then(() => {
    try {
      const info = saveSnapshotSync(world);
      console.log(`Snapshot created: ${info.filename}`);
      return info;
    } catch (e) {
      console.error('Snapshot failed:', e);
    } finally {
      releaseBlockLock();
    }
  });
}

function startSnapshotManager(interval = SNAPSHOT_INTERVAL) {
  if (snapshotTimer) return;

  try {
    const info = saveSnapshotSync(world);
    console.log(`Initial snapshot created: ${info.filename}`);
  } catch (e) {
    console.error('Initial snapshot failed:', e);
  }

  snapshotTimer = setInterval(() => {
    createSnapshotNow();
  }, interval);

  console.log(`Snapshot manager started (interval: ${interval / 1000}s, max: ${MAX_SNAPSHOTS})`);
}

function handleAPI(req, res, parsedUrl) {
  const pathname = parsedUrl.pathname;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (pathname === '/api/snapshots' && req.method === 'GET') {
    const snapshots = listSnapshots().map(s => ({
      ...s,
      size: getSnapshotSize(s.filename),
    }));
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      count: snapshots.length,
      maxSnapshots: MAX_SNAPSHOTS,
      interval: SNAPSHOT_INTERVAL,
      snapshots,
    }));
    return true;
  }

  if (pathname.startsWith('/api/snapshot/restore/') && req.method === 'POST') {
    const parts = pathname.split('/');
    const timestampStr = parts[parts.length - 1];
    const timestamp = parseInt(timestampStr);

    if (isNaN(timestamp)) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: 'Invalid timestamp' }));
      return true;
    }

    rollbackWorld(timestamp)
      .then(() => {
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: `World rolled back to ${timestamp}`,
          timestamp,
          playersNotified: players.size,
        }));
      })
      .catch((e) => {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: e.message }));
      });
    return true;
  }

  if (pathname === '/api/snapshot/create' && req.method === 'POST') {
    acquireBlockLock().then(() => {
      try {
        const info = saveSnapshotSync(world);
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          snapshot: {
            ...info,
            size: getSnapshotSize(info.filename),
          },
        }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: e.message }));
      } finally {
        releaseBlockLock();
      }
    });
    return true;
  }

  if (pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      players: players.size,
      chunks: world.chunks.size,
      snapshotInterval: SNAPSHOT_INTERVAL,
      maxSnapshots: MAX_SNAPSHOTS,
    }));
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname.startsWith('/api/')) {
    if (!handleAPI(req, res, parsedUrl)) {
      res.writeHead(404);
      res.end(JSON.stringify({ success: false, error: 'API endpoint not found' }));
    }
    return;
  }

  if (parsedUrl.pathname === '/admin' || parsedUrl.pathname === '/admin/') {
    let filePath = path.join(__dirname, 'admin.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Admin page not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }

  let filePath = path.join(__dirname, '..', 'client', parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);
  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
  };
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', handleConnection);

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Voxel Sandbox Server running on http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`API: GET /api/snapshots, POST /api/snapshot/restore/:timestamp, POST /api/snapshot/create`);
  startSnapshotManager();
});
