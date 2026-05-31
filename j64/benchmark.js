const { LifeEngine } = require('./core');

const WIDTH = 1000;
const HEIGHT = 1000;
const FRAMES = 100;

async function benchmark() {
  console.log(`=== 康威生命游戏性能基准测试 ===`);
  console.log(`网格大小: ${WIDTH}x${HEIGHT} (${(WIDTH * HEIGHT).toLocaleString()} 细胞)`);
  console.log(`测试帧数: ${FRAMES}`);
  console.log('');

  const engine = new LifeEngine(WIDTH, HEIGHT);
  await engine.init();
  
  engine.fillRandom(0.3);
  
  console.log(`Worker 数量: ${engine.workerCount}`);
  console.log('预热中...');
  
  await new Promise((resolve) => {
    let count = 0;
    const warmup = () => {
      engine.evolve(() => {
        count++;
        if (count < 5) {
          warmup();
        } else {
          resolve();
        }
      });
    };
    warmup();
  });
  
  console.log('开始性能测试...');
  const startTime = Date.now();
  
  let frameCount = 0;
  const results = [];
  
  await new Promise((resolve) => {
    const runFrame = () => {
      const frameStart = Date.now();
      engine.evolve((grid, info) => {
        const frameTime = Date.now() - frameStart;
        results.push(frameTime);
        frameCount++;
        
        if (frameCount % 20 === 0) {
          console.log(`  已完成 ${frameCount}/${FRAMES} 帧, 当前 FPS: ${info.fps}`);
        }
        
        if (frameCount < FRAMES) {
          setImmediate(runFrame);
        } else {
          resolve();
        }
      });
    };
    runFrame();
  });
  
  const totalTime = Date.now() - startTime;
  const avgFps = (FRAMES / (totalTime / 1000)).toFixed(2);
  const avgFrameTime = (results.reduce((a, b) => a + b, 0) / results.length).toFixed(2);
  const minFrameTime = Math.min(...results);
  const maxFrameTime = Math.max(...results);
  
  console.log('');
  console.log('=== 测试结果 ===');
  console.log(`总耗时: ${totalTime}ms`);
  console.log(`平均 FPS: ${avgFps}`);
  console.log(`平均每帧耗时: ${avgFrameTime}ms`);
  console.log(`最快帧: ${minFrameTime}ms`);
  console.log(`最慢帧: ${maxFrameTime}ms`);
  console.log(`目标: 30 FPS (每帧 <= 33.3ms)`);
  console.log('');
  
  if (parseFloat(avgFps) >= 30) {
    console.log('✅ 性能达标! 超过 30 FPS 目标');
  } else {
    console.log('⚠️  性能未达 30 FPS 目标');
  }
  
  await engine.shutdown();
}

benchmark().catch(console.error);
