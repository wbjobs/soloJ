const fs = require('fs');
const path = require('path');
const Recorder = require('../src/server/Recorder');
const { GRID_WIDTH, GRID_HEIGHT, PLANT_TYPES } = require('../src/shared/constants');

class AIAnalyzer {
  constructor(recordingPath) {
    this.recordingPath = recordingPath;
    this.recorder = null;
    this.analysis = null;
  }

  load() {
    if (!fs.existsSync(this.recordingPath)) {
      throw new Error(`录像文件不存在: ${this.recordingPath}`);
    }

    this.recorder = Recorder.loadFromFile(this.recordingPath);
    return this;
  }

  analyze() {
    if (!this.recorder) {
      this.load();
    }

    const events = this.recorder.getEvents();
    const plantEvents = events.filter(e => e.type === 'plant_placed');
    const breakthroughEvents = events.filter(e => e.type === 'zombie_breakthrough');

    this.analysis = {
      filename: path.basename(this.recordingPath),
      roomId: this.recorder.roomId,
      duration: (this.recorder.endTime - this.recorder.startTime) / 1000,
      totalTicks: this.recorder.getTickCount(),
      
      plants: this.analyzePlants(plantEvents),
      breakthrough: this.analyzeBreakthrough(breakthroughEvents),
      heatmap: this.generateHeatmap(),
      timelines: this.generateTimelines(plantEvents)
    };

    return this.analysis;
  }

  analyzePlants(plantEvents) {
    if (plantEvents.length === 0) {
      return {
        total: 0,
        avgReactionTime: 0,
        byType: {},
        byPosition: []
      };
    }

    const intervals = [];
    let lastPlantTime = null;
    const byType = {};
    const byPosition = [];

    for (const event of plantEvents) {
      if (lastPlantTime !== null) {
        intervals.push(event.timestamp - lastPlantTime);
      }
      lastPlantTime = event.timestamp;

      const type = event.data.plantType;
      byType[type] = (byType[type] || 0) + 1;

      byPosition.push({
        x: event.data.x,
        y: event.data.y,
        type,
        tick: event.data.tick,
        timestamp: event.timestamp
      });
    }

    const avgReactionTime = intervals.length > 0 
      ? intervals.reduce((a, b) => a + b, 0) / intervals.length 
      : 0;

    return {
      total: plantEvents.length,
      avgReactionTime,
      medianReactionTime: this.median(intervals),
      minReactionTime: intervals.length > 0 ? Math.min(...intervals) : 0,
      maxReactionTime: intervals.length > 0 ? Math.max(...intervals) : 0,
      placementIntervals: intervals,
      byType,
      byPosition
    };
  }

  analyzeBreakthrough(breakthroughEvents) {
    if (breakthroughEvents.length === 0) {
      return {
        total: 0,
        firstBreakthroughTick: null,
        byRow: {},
        positions: []
      };
    }

    const byRow = {};
    const positions = [];

    for (const event of breakthroughEvents) {
      const row = event.data.y;
      byRow[row] = (byRow[row] || 0) + 1;
      positions.push({
        x: event.data.x,
        y: event.data.y,
        tick: event.data.tick,
        timestamp: event.timestamp
      });
    }

    return {
      total: breakthroughEvents.length,
      firstBreakthroughTick: breakthroughEvents[0].data.tick,
      firstBreakthroughTime: (breakthroughEvents[0].timestamp - this.recorder.startTime) / 1000,
      byRow,
      positions
    };
  }

  generateHeatmap() {
    const heatmap = {
      plant: Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(0)),
      zombie: Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(0)),
      breakthrough: Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(0))
    };

    const events = this.recorder.getEvents();

    for (const event of events) {
      if (event.type === 'plant_placed') {
        heatmap.plant[event.data.y][event.data.x]++;
      } else if (event.type === 'zombie_breakthrough') {
        heatmap.breakthrough[event.data.y][event.data.x]++;
      }
    }

    const tickCount = this.recorder.getTickCount();
    for (let i = 0; i < tickCount; i++) {
      const tick = this.recorder.getTickState(i);
      if (!tick) continue;
      const grid = tick.state.grid;

      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          if (grid[y][x] === 'Z' || grid[y][x] === 'C' || grid[y][x] === 'B') {
            heatmap.zombie[y][x]++;
          }
        }
      }
    }

    return heatmap;
  }

  generateTimelines(plantEvents) {
    const perSecond = {};
    const duration = (this.recorder.endTime - this.recorder.startTime) / 1000;

    for (let i = 0; i <= Math.ceil(duration); i++) {
      perSecond[i] = 0;
    }

    for (const event of plantEvents) {
      const second = Math.floor((event.timestamp - this.recorder.startTime) / 1000);
      if (perSecond[second] !== undefined) {
        perSecond[second]++;
      }
    }

    return {
      perSecond,
      cumulative: this.cumulative(perSecond)
    };
  }

  median(arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  cumulative(perSecond) {
    const result = {};
    let sum = 0;
    for (const [second, count] of Object.entries(perSecond)) {
      sum += count;
      result[second] = sum;
    }
    return result;
  }

  exportCSV(outputDir = './analysis') {
    if (!this.analysis) {
      this.analyze();
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const baseName = path.basename(this.recordingPath, '.zgr');

    this.exportPlantHeatmapCSV(path.join(outputDir, `${baseName}_plant_heatmap.csv`));
    this.exportZombieHeatmapCSV(path.join(outputDir, `${baseName}_zombie_heatmap.csv`));
    this.exportBreakthroughHeatmapCSV(path.join(outputDir, `${baseName}_breakthrough_heatmap.csv`));
    this.exportSummaryCSV(path.join(outputDir, `${baseName}_summary.csv`));
    this.exportPlantPlacementsCSV(path.join(outputDir, `${baseName}_placements.csv`));

    console.log(`分析结果已导出到: ${outputDir}/`);
    return outputDir;
  }

  exportPlantHeatmapCSV(filepath) {
    let csv = 'y\\x,' + Array.from({ length: GRID_WIDTH }, (_, i) => i).join(',') + '\n';
    for (let y = 0; y < GRID_HEIGHT; y++) {
      csv += y + ',' + this.analysis.heatmap.plant[y].join(',') + '\n';
    }
    fs.writeFileSync(filepath, csv);
  }

  exportZombieHeatmapCSV(filepath) {
    let csv = 'y\\x,' + Array.from({ length: GRID_WIDTH }, (_, i) => i).join(',') + '\n';
    for (let y = 0; y < GRID_HEIGHT; y++) {
      csv += y + ',' + this.analysis.heatmap.zombie[y].join(',') + '\n';
    }
    fs.writeFileSync(filepath, csv);
  }

  exportBreakthroughHeatmapCSV(filepath) {
    let csv = 'y\\x,' + Array.from({ length: GRID_WIDTH }, (_, i) => i).join(',') + '\n';
    for (let y = 0; y < GRID_HEIGHT; y++) {
      csv += y + ',' + this.analysis.heatmap.breakthrough[y].join(',') + '\n';
    }
    fs.writeFileSync(filepath, csv);
  }

  exportSummaryCSV(filepath) {
    const a = this.analysis;
    const csv = `Metric,Value
文件名,${a.filename}
房间ID,${a.roomId}
游戏时长(秒),${a.duration.toFixed(2)}
总帧数,${a.totalTicks}
放置植物总数,${a.plants.total}
平均放置间隔(ms),${a.plants.avgReactionTime.toFixed(0)}
中位放置间隔(ms),${a.plants.medianReactionTime.toFixed(0)}
最快放置间隔(ms),${a.plants.minReactionTime.toFixed(0)}
最慢放置间隔(ms),${a.plants.maxReactionTime.toFixed(0)}
僵尸突破次数,${a.breakthrough.total}
首次突破时间(秒),${a.breakthrough.firstBreakthroughTime?.toFixed(2) || 'N/A'}
首次突破帧数,${a.breakthrough.firstBreakthroughTick || 'N/A'}
`;
    fs.writeFileSync(filepath, csv);
  }

  exportPlantPlacementsCSV(filepath) {
    let csv = 'index,tick,time_s,x,y,plant_type\n';
    this.analysis.plants.byPosition.forEach((p, i) => {
      const time = ((p.timestamp - this.recorder.startTime) / 1000).toFixed(2);
      csv += `${i + 1},${p.tick},${time},${p.x},${p.y},${p.type}\n`;
    });
    fs.writeFileSync(filepath, csv);
  }

  printReport() {
    if (!this.analysis) {
      this.analyze();
    }

    const a = this.analysis;

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║              AI 分析报告 - 游戏统计                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n📁 文件: ${a.filename}`);
    console.log(`🏠 房间: ${a.roomId}`);
    console.log(`⏱  时长: ${a.duration.toFixed(1)} 秒`);
    console.log(`🎞  帧数: ${a.totalTicks}`);

    console.log('\n─────────── 🌱 植物放置统计 ───────────');
    console.log(`总数: ${a.plants.total} 株`);
    console.log(`平均放置间隔: ${a.plants.avgReactionTime.toFixed(0)}ms`);
    console.log(`中位放置间隔: ${a.plants.medianReactionTime.toFixed(0)}ms`);
    console.log(`最快/最慢: ${a.plants.minReactionTime.toFixed(0)}ms / ${a.plants.maxReactionTime.toFixed(0)}ms`);

    console.log('\n按类型分布:');
    for (const [type, count] of Object.entries(a.plants.byType)) {
      const plantInfo = PLANT_TYPES[type];
      const pct = ((count / a.plants.total) * 100).toFixed(1);
      console.log(`  ${plantInfo?.name || type}: ${count} 株 (${pct}%)`);
    }

    console.log('\n─────────── 🧟 僵尸突破统计 ───────────');
    console.log(`突破次数: ${a.breakthrough.total} 次`);
    if (a.breakthrough.firstBreakthroughTime !== null) {
      console.log(`首次突破时间: ${a.breakthrough.firstBreakthroughTime.toFixed(1)} 秒 (帧 ${a.breakthrough.firstBreakthroughTick})`);
    }

    console.log('\n按行分布:');
    for (const [row, count] of Object.entries(a.breakthrough.byRow).sort((a, b) => b[1] - a[1])) {
      const pct = ((count / a.breakthrough.total) * 100).toFixed(1);
      console.log(`  第 ${row} 行: ${count} 次 (${pct}%)`);
    }

    console.log('\n─────────── 🗺  植物放置热力图 ───────────');
    this.printHeatmap(a.heatmap.plant);

    console.log('\n─────────── 🔥 僵尸热力图 ───────────');
    this.printHeatmap(a.heatmap.zombie, true);

    console.log('\n─────────── 💀 突破点位热力图 ───────────');
    this.printHeatmap(a.heatmap.breakthrough);

    console.log('\n✅ 分析完成!');
  }

  printHeatmap(heatmap, normalize = false) {
    let max = 1;
    if (normalize) {
      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          max = Math.max(max, heatmap[y][x]);
        }
      }
    }

    const levels = [' ', '░', '▒', '▓', '█'];

    console.log('   ' + '─'.repeat(GRID_WIDTH + 2));
    for (let y = 0; y < GRID_HEIGHT; y++) {
      let row = `${y.toString().padStart(2)} │`;
      for (let x = 0; x < GRID_WIDTH; x++) {
        const val = heatmap[y][x];
        if (normalize) {
          const level = Math.min(4, Math.floor((val / max) * 5));
          row += levels[level];
        } else {
          row += val > 0 ? val.toString() : ' ';
        }
      }
      row += '│';
      console.log(row);
    }
    console.log('   ' + '─'.repeat(GRID_WIDTH + 2));
  }
}

module.exports = AIAnalyzer;
