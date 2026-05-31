const fs = require('fs');
const path = require('path');
const { Chunk, CHUNK_SIZE } = require('./world');

const SNAPSHOT_VERSION = 1;
const SNAPSHOT_DIR = path.join(__dirname, 'snapshots');
const MAX_SNAPSHOTS = 30;
const SNAPSHOT_INTERVAL = 60 * 1000;

if (!fs.existsSync(SNAPSHOT_DIR)) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

function snapshotFilename(timestamp) {
  const dt = new Date(timestamp);
  const pad = (n) => n.toString().padStart(2, '0');
  const dateStr = `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}`;
  const timeStr = `${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}`;
  return `voxel_${timestamp}_${dateStr}_${timeStr}.bin`;
}

function parseSnapshotFilename(filename) {
  const match = filename.match(/voxel_(\d+)_(\d{8})_(\d{6})\.bin/);
  if (!match) return null;
  return {
    filename,
    timestamp: parseInt(match[1]),
    date: match[2],
    time: match[3],
    dateStr: new Date(parseInt(match[1])).toLocaleString('zh-CN'),
  };
}

function serializeWorld(world) {
  const chunks = [];
  for (const chunk of world.chunks.values()) {
    chunks.push(chunk);
  }

  const chunkDataSize = 4 + 4 + 4 + CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE;
  const totalSize = 1 + 4 + chunks.length * chunkDataSize;

  const buffer = Buffer.alloc(totalSize);
  let offset = 0;

  buffer.writeUInt8(SNAPSHOT_VERSION, offset);
  offset += 1;

  buffer.writeUInt32LE(chunks.length, offset);
  offset += 4;

  for (const chunk of chunks) {
    buffer.writeInt32LE(chunk.cx, offset);
    offset += 4;
    buffer.writeInt32LE(chunk.cy, offset);
    offset += 4;
    buffer.writeInt32LE(chunk.cz, offset);
    offset += 4;

    for (let i = 0; i < chunk.blocks.length; i++) {
      buffer.writeUInt8(chunk.blocks[i], offset + i);
    }
    offset += chunk.blocks.length;
  }

  return buffer;
}

function deserializeWorld(buffer, world) {
  let offset = 0;

  const version = buffer.readUInt8(offset);
  offset += 1;

  if (version !== SNAPSHOT_VERSION) {
    throw new Error(`Unsupported snapshot version: ${version}, expected: ${SNAPSHOT_VERSION}`);
  }

  const numChunks = buffer.readUInt32LE(offset);
  offset += 4;

  world.chunks.clear();

  for (let i = 0; i < numChunks; i++) {
    const cx = buffer.readInt32LE(offset);
    offset += 4;
    const cy = buffer.readInt32LE(offset);
    offset += 4;
    const cz = buffer.readInt32LE(offset);
    offset += 4;

    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
    for (let j = 0; j < blocks.length; j++) {
      blocks[j] = buffer.readUInt8(offset + j);
    }
    offset += blocks.length;

    const chunk = new Chunk(cx, cy, cz);
    chunk.blocks = blocks;
    world.chunks.set(world.chunkKey(cx, cy, cz), chunk);
  }

  return world;
}

function saveSnapshotSync(world) {
  const timestamp = Date.now();
  const buffer = serializeWorld(world);
  const filename = snapshotFilename(timestamp);
  const filepath = path.join(SNAPSHOT_DIR, filename);

  fs.writeFileSync(filepath, buffer);
  cleanupOldSnapshotsSync();

  return parseSnapshotFilename(filename);
}

function loadSnapshotSync(timestamp, world) {
  const files = fs.readdirSync(SNAPSHOT_DIR);
  const target = files.find(f => f.includes(`voxel_${timestamp}_`));
  if (!target) {
    throw new Error(`Snapshot not found for timestamp: ${timestamp}`);
  }

  const filepath = path.join(SNAPSHOT_DIR, target);
  const buffer = fs.readFileSync(filepath);
  return deserializeWorld(buffer, world);
}

function listSnapshots() {
  try {
    const files = fs.readdirSync(SNAPSHOT_DIR);
    const snapshots = files
      .map(parseSnapshotFilename)
      .filter(Boolean)
      .sort((a, b) => b.timestamp - a.timestamp);
    return snapshots;
  } catch (e) {
    return [];
  }
}

function getSnapshotSize(filename) {
  const filepath = path.join(SNAPSHOT_DIR, filename);
  try {
    const stats = fs.statSync(filepath);
    return (stats.size / 1024).toFixed(2) + ' KB';
  } catch {
    return '? KB';
  }
}

function cleanupOldSnapshotsSync() {
  const snapshots = listSnapshots();
  if (snapshots.length <= MAX_SNAPSHOTS) return;

  const toDelete = snapshots.slice(MAX_SNAPSHOTS);
  for (const s of toDelete) {
    const filepath = path.join(SNAPSHOT_DIR, s.filename);
    try {
      fs.unlinkSync(filepath);
    } catch (e) {}
  }
}

module.exports = {
  serializeWorld,
  deserializeWorld,
  saveSnapshotSync,
  loadSnapshotSync,
  listSnapshots,
  getSnapshotSize,
  SNAPSHOT_DIR,
  SNAPSHOT_VERSION,
  MAX_SNAPSHOTS,
  SNAPSHOT_INTERVAL,
};
