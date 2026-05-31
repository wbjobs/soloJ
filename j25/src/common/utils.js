const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

function generateTaskId() {
  return uuidv4();
}

function generateWorkerId() {
  return `worker-${uuidv4().slice(0, 8)}`;
}

function splitIntoBlocks(width, height, blockSize = 16) {
  const blocks = [];
  let blockId = 0;

  for (let y = 0; y < height; y += blockSize) {
    for (let x = 0; x < width; x += blockSize) {
      blocks.push({
        blockId: blockId++,
        startX: x,
        startY: y,
        endX: Math.min(x + blockSize, width),
        endY: Math.min(y + blockSize, height)
      });
    }
  }

  return blocks;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

module.exports = {
  generateTaskId,
  generateWorkerId,
  splitIntoBlocks,
  ensureDir,
  formatTime
};
