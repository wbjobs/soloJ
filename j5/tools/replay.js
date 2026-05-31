const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Recorder = require('../src/server/Recorder');
const { GRID_WIDTH, GRID_HEIGHT, PLANT_TYPES } = require('../src/shared/constants');

class ReplayPlayer {
  constructor(recordingPath, playbackSpeed = 1) {
    this.recordingPath = recordingPath;
    this.playbackSpeed = playbackSpeed;
    this.recorder = null;
    this.currentTick = 0;
    this.playing = false;
    this.paused = false;
    this.playInterval = null;
    this.lastMessage = '';
  }

  load() {
    if (!fs.existsSync(this.recordingPath)) {
      throw new Error(`录像文件不存在: ${this.recordingPath}`);
    }

    this.recorder = Recorder.loadFromFile(this.recordingPath);
    console.log(`已加载录像: ${this.recordingPath}`);
    console.log(`房间: ${this.recorder.roomId}`);
    console.log(`总时长: ${((this.recorder.endTime - this.recorder.startTime) / 1000).toFixed(1)}秒`);
    console.log(`总帧数: ${this.recorder.getTickCount()}`);
    console.log(`播放速度: ${this.playbackSpeed}x`);
    console.log();
  }

  start() {
    if (!this.recorder) {
      this.load();
    }

    this.setupInput();
    this.render();
    this.startPlayback();
  }

  setupInput() {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdin.on('keypress', (str, key) => {
      if (key.ctrl && key.name === 'c') {
        this.stop();
        process.exit(0);
      }

      switch (key.name) {
        case 'space':
          this.togglePause();
          break;
        case 'left':
          this.seek(-10);
          break;
        case 'right':
          this.seek(10);
          break;
        case 'up':
          this.setSpeed(this.playbackSpeed * 2);
          break;
        case 'down':
          this.setSpeed(Math.max(0.25, this.playbackSpeed / 2));
          break;
        case 'r':
          this.restart();
          break;
        case 'escape':
          this.stop();
          process.exit(0);
          break;
      }
    });
  }

  startPlayback() {
    this.playing = true;
    this.scheduleNextTick();
  }

  scheduleNextTick() {
    if (!this.playing || this.paused) return;

    const interval = 100 / this.playbackSpeed;
    this.playInterval = setTimeout(() => {
      if (this.currentTick < this.recorder.getTickCount() - 1) {
        this.currentTick++;
        this.render();
        this.scheduleNextTick();
      } else {
        this.playing = false;
        this.lastMessage = '播放完成! 按 R 重新播放';
        this.render();
      }
    }, interval);
  }

  togglePause() {
    this.paused = !this.paused;
    if (!this.paused && this.playing) {
      this.scheduleNextTick();
    }
    this.lastMessage = this.paused ? '已暂停' : '继续播放';
    this.render();
  }

  seek(delta) {
    this.currentTick = Math.max(0, Math.min(this.recorder.getTickCount() - 1, this.currentTick + delta));
    this.lastMessage = `跳转到帧 ${this.currentTick}`;
    this.render();
  }

  setSpeed(speed) {
    this.playbackSpeed = speed;
    this.lastMessage = `播放速度: ${speed.toFixed(2)}x`;
    this.render();
  }

  restart() {
    this.currentTick = 0;
    this.playing = true;
    this.paused = false;
    this.lastMessage = '重新开始播放';
    this.scheduleNextTick();
    this.render();
  }

  stop() {
    this.playing = false;
    if (this.playInterval) {
      clearTimeout(this.playInterval);
    }
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
  }

  render() {
    const tickData = this.recorder.getTickState(this.currentTick);
    if (!tickData) return;

    const state = tickData.state;
    const progress = ((this.currentTick / this.recorder.getTickCount()) * 100).toFixed(1);

    this.clearScreen();

    console.log('╔══════════════════════════════════════════╗');
    console.log('║          植物大战僵尸 - 录像回放         ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log(`\n文件: ${path.basename(this.recordingPath)}`);
    console.log(`帧: ${this.currentTick}/${this.recorder.getTickCount()} (${progress}%) | 速度: ${this.playbackSpeed}x`);
    console.log(`分数: ${state.s} | 阳光: ☀️ ${state.u}`);

    this.renderGrid(state.grid);

    console.log('\n─────────── 控制 ───────────');
    console.log('空格 - 暂停/继续');
    console.log('←→ - 前进/后退 10 帧');
    console.log('↑↓ - 加速/减速');
    console.log('R - 重新播放');
    console.log('ESC - 退出');

    if (this.lastMessage) {
      console.log(`\n[${this.lastMessage}]`);
    }
  }

  renderGrid(grid) {
    console.log('\n   ' + '─'.repeat(GRID_WIDTH * 2 + 1));

    for (let y = 0; y < GRID_HEIGHT; y++) {
      let row = `${y.toString().padStart(2)} │`;

      for (let x = 0; x < GRID_WIDTH; x++) {
        const cell = grid[y][x];
        row += ` ${cell} `;
      }

      row += '│';
      console.log(row);
    }

    console.log('   ' + '─'.repeat(GRID_WIDTH * 2 + 1));
    console.log('     ' + Array.from({ length: GRID_WIDTH }, (_, i) => i.toString().padStart(2)).join(' '));
  }

  clearScreen() {
    process.stdout.write('\x1B[2J\x1B[0f');
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    file: null,
    speed: 1
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--file':
      case '-f':
        options.file = args[++i];
        break;
      case '--speed':
      case '-s':
        options.speed = parseFloat(args[++i]) || 1;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (!options.file) {
          options.file = args[i];
        }
    }
  }

  return options;
}

function printHelp() {
  console.log(`
植物大战僵尸 - 录像回放工具

用法:
  node tools/replay.js [options] <file>

选项:
  --file, -f <path>    录像文件路径
  --speed, -s <x>      播放速度 (默认: 1, 支持 0.25, 0.5, 1, 2, 4 等)

控制:
  空格                 暂停/继续
  ←→                   前进/后退 10 帧
  ↑↓                   加速/减速
  R                    重新播放
  ESC                  退出

示例:
  node tools/replay.js recordings/game_ABC123_1234567890.zgr
  node tools/replay.js --file recordings/game_ABC123.zgr --speed 2
`);
}

function listRecordings() {
  const recordingsDir = './recordings';
  if (!fs.existsSync(recordingsDir)) {
    console.log('没有找到 recordings 目录');
    return [];
  }

  const files = fs.readdirSync(recordingsDir)
    .filter(f => f.endsWith('.zgr'))
    .sort((a, b) => fs.statSync(path.join(recordingsDir, b)).mtime - fs.statSync(path.join(recordingsDir, a)).mtime);

  if (files.length === 0) {
    console.log('没有找到录像文件');
    return [];
  }

  console.log('可用的录像文件:');
  files.forEach((f, i) => {
    const stat = fs.statSync(path.join(recordingsDir, f));
    console.log(`  ${i + 1}. ${f} (${(stat.size / 1024).toFixed(1)}KB, ${new Date(stat.mtime).toLocaleString()})`);
  });

  return files.map(f => path.join(recordingsDir, f));
}

const options = parseArgs();

if (!options.file) {
  const files = listRecordings();
  if (files.length === 0) {
    console.log('\n请先玩一局游戏来生成录像文件!');
    process.exit(1);
  }
  options.file = files[0];
  console.log(`\n自动选择最新录像: ${options.file}\n`);
}

const player = new ReplayPlayer(options.file, options.speed);
player.start();
