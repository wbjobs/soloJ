const fs = require('fs');
const path = require('path');
const AIAnalyzer = require('./AIAnalyzer');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    file: null,
    output: './analysis',
    showReport: true,
    exportCSV: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--file':
      case '-f':
        options.file = args[++i];
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--csv':
      case '-c':
        options.exportCSV = true;
        break;
      case '--no-report':
        options.showReport = false;
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
植物大战僵尸 - AI 分析工具

用法:
  node tools/analyze.js [options] <file>

选项:
  --file, -f <path>     录像文件路径
  --output, -o <dir>   CSV 输出目录 (默认: ./analysis)
  --csv, -c             导出 CSV 文件
  --no-report           不显示分析报告
  --help, -h            显示帮助

示例:
  node tools/analyze.js recordings/game_ABC123.zgr
  node tools/analyze.js --file recordings/game_ABC123.zgr --csv
  node tools/analyze.js recordings/game_ABC123.zgr -c -o ./output
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

try {
  const analyzer = new AIAnalyzer(options.file);
  analyzer.load();
  analyzer.analyze();

  if (options.showReport) {
    analyzer.printReport();
  }

  if (options.exportCSV) {
    analyzer.exportCSV(options.output);
  }

} catch (err) {
  console.error('分析失败:', err.message);
  process.exit(1);
}
