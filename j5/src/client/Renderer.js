const { GRID_WIDTH, GRID_HEIGHT, PLANT_TYPES } = require('../shared/constants');

class Renderer {
  constructor(isWatcher = false) {
    this.isWatcher = isWatcher;
    this.cursorX = 0;
    this.cursorY = 0;
    this.selectedPlant = 'PEASHOOTER';
    this.currentState = null;
    this.predictedPlants = new Map();
    this.predictedSunPoints = null;
    this.latency = 0;
  }

  addPredictedPlant(sequence, x, y, plantType, predictedSunPoints) {
    this.predictedPlants.set(sequence, { x, y, plantType, timestamp: Date.now() });
    this.predictedSunPoints = predictedSunPoints;
  }

  removePredictedPlant(sequence) {
    this.predictedPlants.delete(sequence);
    if (this.predictedPlants.size === 0) {
      this.predictedSunPoints = null;
    }
  }

  clearPredictedPlants() {
    this.predictedPlants.clear();
    this.predictedSunPoints = null;
  }

  setLatency(latency) {
    this.latency = latency;
  }

  setCursor(x, y) {
    this.cursorX = Math.max(0, Math.min(GRID_WIDTH - 1, x));
    this.cursorY = Math.max(0, Math.min(GRID_HEIGHT - 1, y));
  }

  moveCursor(dx, dy) {
    this.setCursor(this.cursorX + dx, this.cursorY + dy);
  }

  selectPlant(plantType) {
    if (PLANT_TYPES[plantType]) {
      this.selectedPlant = plantType;
    }
  }

  render(state) {
    this.currentState = state;
    this.clearScreen();

    console.log('╔══════════════════════════════════════════╗');
    console.log('║          植物大战僵尸 - 网络版           ║');
    console.log('╚══════════════════════════════════════════╝');

    if (this.isWatcher) {
      console.log('\n👁  观战模式 - 房间: ' + state.roomId);
    } else {
      console.log('\n房间: ' + state.roomId + ' | 状态: ' + this.getStatusText(state.status));
      if (this.latency > 0) {
        console.log('延迟: ~' + this.latency + 'ms | 待确认操作: ' + this.predictedPlants.size);
      }
    }

    const displaySunPoints = this.predictedSunPoints !== null ? this.predictedSunPoints : state.sunPoints;
    console.log('分数: ' + state.score + ' | 阳光: ☀️ ' + displaySunPoints);

    this.renderGrid(state);

    if (!this.isWatcher) {
      this.renderControls();
    } else {
      console.log('\n[观战模式] 按 Ctrl+C 退出');
    }

    if (state.status === 'gameover') {
      console.log('\n💀 游戏结束! 僵尸进入了你的房子!');
    }
  }

  renderGrid(state) {
    const grid = JSON.parse(JSON.stringify(state.grid));

    for (const [sequence, plant] of this.predictedPlants) {
      const plantType = PLANT_TYPES[plant.plantType];
      if (plantType && grid[plant.y] && grid[plant.y][plant.x]) {
        if (grid[plant.y][plant.x] === '-') {
          grid[plant.y][plant.x] = plantType.symbol.toLowerCase();
        }
      }
    }

    console.log('\n   ' + '─'.repeat(GRID_WIDTH * 2 + 1));

    for (let y = 0; y < GRID_HEIGHT; y++) {
      let row = `${y.toString().padStart(2)} │`;

      for (let x = 0; x < GRID_WIDTH; x++) {
        const cell = grid[y][x];

        if (!this.isWatcher && x === this.cursorX && y === this.cursorY) {
          row += `[${cell}]`;
        } else {
          row += ` ${cell} `;
        }
      }

      row += '│';
      console.log(row);
    }

    console.log('   ' + '─'.repeat(GRID_WIDTH * 2 + 1));
    console.log('     ' + Array.from({ length: GRID_WIDTH }, (_, i) => i.toString().padStart(2)).join(' '));

    if (this.predictedPlants.size > 0) {
      console.log('\n* 小写字符表示待服务器确认的预测植物');
    }
  }

  renderControls() {
    const plantType = PLANT_TYPES[this.selectedPlant];

    console.log('\n─────────── 控制面板 ───────────');
    console.log('WASD - 移动光标');
    console.log('空格 - 放置植物');
    console.log('1/2/3 - 切换植物类型');
    console.log('─────────── 植物选择 ───────────');

    for (const [key, plant] of Object.entries(PLANT_TYPES)) {
      const selected = key === this.selectedPlant ? '◄ 当前选择' : '';
      const canAfford = this.currentState && this.currentState.sunPoints >= plant.cost ? '✓' : '✗';
      console.log(`${key[0]} - ${plant.name} [${plant.symbol}] HP:${plant.hp} 花费:${plant.cost} ${canAfford} ${selected}`);
    }

    console.log('\n光标位置: (' + this.cursorX + ', ' + this.cursorY + ')');
  }

  getStatusText(status) {
    const statusMap = {
      'waiting': '等待中',
      'playing': '游戏中',
      'gameover': '游戏结束'
    };
    return statusMap[status] || status;
  }

  clearScreen() {
    process.stdout.write('\x1B[2J\x1B[0f');
  }
}

module.exports = Renderer;
