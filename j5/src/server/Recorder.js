const fs = require('fs');
const path = require('path');
const { GRID_WIDTH, GRID_HEIGHT } = require('../shared/constants');

const RECORDING_MAGIC = 0x5A474D52;
const RECORDING_VERSION = 1;

class Recorder {
  constructor(roomId) {
    this.roomId = roomId;
    this.tickSnapshots = [];
    this.events = [];
    this.startTime = Date.now();
    this.endTime = null;
  }

  recordTick(tick, state) {
    this.tickSnapshots.push({
      tick,
      timestamp: Date.now(),
      state: this.compressState(state)
    });
  }

  recordEvent(type, data) {
    this.events.push({
      type,
      timestamp: Date.now(),
      tick: this.tickSnapshots.length,
      data
    });
  }

  compressState(state) {
    const compressed = {
      s: state.score,
      u: state.sunPoints,
      g: this.compressGrid(state.grid)
    };
    return compressed;
  }

  compressGrid(grid) {
    const charMap = {
      '-': 0,
      'P': 1,
      'Z': 2,
      'S': 3,
      'W': 4,
      'C': 5,
      'B': 6
    };
    
    const bytes = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x += 2) {
        const cell1 = charMap[grid[y][x]] || 0;
        const cell2 = x + 1 < GRID_WIDTH ? (charMap[grid[y][x + 1]] || 0) : 0;
        bytes.push((cell1 << 4) | cell2);
      }
    }
    return Buffer.from(bytes).toString('base64');
  }

  static decompressGrid(compressed) {
    const charMap = ['-', 'P', 'Z', 'S', 'W', 'C', 'B'];
    const bytes = Buffer.from(compressed, 'base64');
    const grid = [];
    
    let byteIndex = 0;
    for (let y = 0; y < GRID_HEIGHT; y++) {
      const row = [];
      for (let x = 0; x < GRID_WIDTH; x += 2) {
        const byte = bytes[byteIndex++];
        row.push(charMap[(byte >> 4) & 0x0F]);
        if (x + 1 < GRID_WIDTH) {
          row.push(charMap[byte & 0x0F]);
        }
      }
      grid.push(row);
    }
    return grid;
  }

  finish() {
    this.endTime = Date.now();
  }

  saveToFile(outputDir = './recordings') {
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const filename = `game_${this.roomId}_${this.startTime}.zgr`;
      const filepath = path.join(outputDir, filename);

      const startTimeStr = this.startTime.toString();
      const endTimeStr = (this.endTime || Date.now()).toString();

      const header = Buffer.alloc(24);
      header.writeUInt32LE(RECORDING_MAGIC, 0);
      header.writeUInt32LE(RECORDING_VERSION, 4);
      header.write(startTimeStr.padEnd(8, '\x00'), 8, 8, 'ascii');
      header.write(endTimeStr.padEnd(8, '\x00'), 16, 8, 'ascii');

      const data = JSON.stringify({
        roomId: this.roomId,
        duration: (this.endTime || Date.now()) - this.startTime,
        tickCount: this.tickSnapshots.length,
        eventCount: this.events.length,
        ticks: this.tickSnapshots,
        events: this.events
      });

      const dataBuffer = Buffer.from(data, 'utf8');
      const lengthBuffer = Buffer.alloc(4);
      lengthBuffer.writeUInt32LE(dataBuffer.length, 0);

      const fullBuffer = Buffer.concat([header, lengthBuffer, dataBuffer]);
      fs.writeFileSync(filepath, fullBuffer);

      console.log(`[Recorder] 录像已保存: ${filepath} (${(fullBuffer.length / 1024).toFixed(1)}KB, ${this.tickSnapshots.length} 帧)`);
      return filepath;
    } catch (err) {
      console.error('[Recorder] 保存录像失败:', err.message);
      throw err;
    }
  }

  static loadFromFile(filepath) {
    const fullBuffer = fs.readFileSync(filepath);

    const magic = fullBuffer.readUInt32LE(0);
    if (magic !== RECORDING_MAGIC) {
      throw new Error('Invalid recording file format');
    }

    const version = fullBuffer.readUInt32LE(4);
    if (version !== RECORDING_VERSION) {
      throw new Error(`Unsupported recording version: ${version}`);
    }

    const startTime = parseInt(fullBuffer.toString('ascii', 8, 16).trim());
    const endTime = parseInt(fullBuffer.toString('ascii', 16, 24).trim());
    const dataLength = fullBuffer.readUInt32LE(24);
    const data = fullBuffer.slice(28, 28 + dataLength).toString('utf8');
    const parsed = JSON.parse(data);

    const recorder = new Recorder(parsed.roomId);
    recorder.startTime = startTime;
    recorder.endTime = endTime;
    recorder.tickSnapshots = parsed.ticks;
    recorder.events = parsed.events;

    return recorder;
  }

  getTickCount() {
    return this.tickSnapshots.length;
  }

  getTickState(index) {
    if (index < 0 || index >= this.tickSnapshots.length) {
      return null;
    }

    const snapshot = this.tickSnapshots[index];
    return {
      ...snapshot,
      state: {
        ...snapshot.state,
        grid: Recorder.decompressGrid(snapshot.state.g)
      }
    };
  }

  getEvents() {
    return this.events;
  }

  getEventsByType(type) {
    return this.events.filter(e => e.type === type);
  }
}

module.exports = Recorder;
