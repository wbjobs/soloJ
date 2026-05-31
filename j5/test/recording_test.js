const net = require('net');
const fs = require('fs');
const path = require('path');
const { SERVER_PORT, MESSAGE_TYPES } = require('../src/shared/constants');

let testRoomId = null;
let serverProcess = null;

console.log('=== 游戏录像与 AI 分析功能测试 ===\n');

runFullTest();

async function runFullTest() {
  try {
    console.log('[1/4] 启动服务器...');
    await startServer();
    await delay(1000);

    console.log('\n[2/4] 模拟一局游戏...');
    await simulateGame();
    await delay(500);

    console.log('\n[3/4] 查找录像文件...');
    const recordingFile = findLatestRecording();
    if (!recordingFile) {
      throw new Error('未找到录像文件!');
    }
    console.log(`  ✓ 找到录像: ${recordingFile}`);

    console.log('\n[4/4] AI 分析并导出 CSV...');
    await runAnalysis(recordingFile);

    console.log('\n=== 所有测试通过! ===');
    console.log('\n可用命令:');
    console.log('  node tools/replay.js <file>      # 回放录像');
    console.log('  node tools/analyze.js <file>     # AI 分析');
    console.log('  node tools/analyze.js <file> --csv  # 导出 CSV');
    
    process.exit(0);
  } catch (err) {
    console.error('测试失败:', err.message);
    process.exit(1);
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    serverProcess = spawn('node', ['src/server/index.js'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('游戏服务器已启动')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('服务器错误:', data.toString());
    });

    setTimeout(() => reject(new Error('服务器启动超时')), 5000);
  });
}

function simulateGame() {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({
      host: 'localhost',
      port: SERVER_PORT
    }, () => {
      console.log('  ✓ 客户端已连接');

      let sequence = 0;
      let gameOver = false;

      client.on('data', (data) => {
        const messages = data.toString().split('\n').filter(m => m.trim());
        
        for (const msg of messages) {
          try {
            const parsed = JSON.parse(msg);
            
            if (parsed.type === MESSAGE_TYPES.INFO && !testRoomId) {
              testRoomId = parsed.roomId;
              console.log(`  ✓ 创建房间: ${testRoomId}`);
              
              placePlants(client);
            }
            
            if (parsed.type === MESSAGE_TYPES.STATE && parsed.state.status === 'gameover') {
              if (!gameOver) {
                gameOver = true;
                console.log('  ✓ 游戏结束');
                setTimeout(() => {
                  client.destroy();
                }, 200);
                setTimeout(() => {
                  serverProcess.kill();
                  resolve();
                }, 500);
              }
            }
          } catch (e) {}
        }
      });

      client.write(JSON.stringify({
        type: MESSAGE_TYPES.JOIN
      }) + '\n');
    });

    client.on('error', reject);
    setTimeout(() => reject(new Error('游戏模拟超时')), 15000);
  });
}

function placePlants(client) {
  const positions = [
    { x: 2, y: 2, type: 'PEASHOOTER' },
    { x: 2, y: 4, type: 'PEASHOOTER' },
    { x: 2, y: 6, type: 'PEASHOOTER' },
    { x: 1, y: 1, type: 'WALLNUT' },
    { x: 1, y: 5, type: 'SUNFLOWER' }
  ];

  let seq = 1;
  positions.forEach((pos, i) => {
    setTimeout(() => {
      client.write(JSON.stringify({
        type: MESSAGE_TYPES.ACTION,
        action: 'place_plant',
        sequence: seq++,
        timestamp: Date.now(),
        x: pos.x,
        y: pos.y,
        plantType: pos.type
      }) + '\n');
      console.log(`  放置 ${pos.type} at (${pos.x}, ${pos.y})`);
    }, i * 300);
  });

  setTimeout(() => {
    console.log('  发送结束游戏命令');
    client.write(JSON.stringify({
      type: MESSAGE_TYPES.ADMIN,
      command: 'end_game'
    }) + '\n');
  }, positions.length * 300 + 500);
}

function findLatestRecording() {
  const dir = './recordings';
  if (!fs.existsSync(dir)) return null;

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.zgr'))
    .map(f => ({
      name: f,
      path: path.join(dir, f),
      time: fs.statSync(path.join(dir, f)).mtime
    }))
    .sort((a, b) => b.time - a.time);

  console.log('  找到录像文件:', files.map(f => f.name));
  return files[0]?.path;
}

function runAnalysis(recordingFile) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const analyzer = spawn('node', ['tools/analyze.js', recordingFile, '--csv'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    analyzer.stdout.on('data', (data) => {
      output += data.toString();
    });

    analyzer.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    analyzer.on('close', (code) => {
      if (code === 0) {
        console.log('  ✓ 分析完成');
        
        const csvFiles = fs.readdirSync('./analysis').filter(f => f.endsWith('.csv'));
        console.log(`  ✓ 导出 ${csvFiles.length} 个 CSV 文件:`);
        csvFiles.forEach(f => console.log(`    - ${f}`));
        
        resolve();
      } else {
        reject(new Error(`分析器退出码: ${code}`));
      }
    });

    setTimeout(() => reject(new Error('分析超时')), 10000);
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
