const { LifeEngine } = require('./core');
const LifeGrid = require('./core/life-grid');

const SIZE = 20;

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    passed++;
    console.log('  ✅ ' + name);
  } else {
    failed++;
    console.log('  ❌ ' + name);
  }
}

async function testCornerNeighbors() {
  console.log('\n=== 测试 1: 四角邻居计数 ===');
  
  const grid = new LifeGrid(SIZE, SIZE);
  
  grid.set(0, 0, true);
  grid.set(SIZE - 1, 0, true);
  grid.set(0, SIZE - 1, true);
  grid.set(SIZE - 1, SIZE - 1, true);
  
  const n00 = grid.countNeighbors(0, 0);
  const nLastLast = grid.countNeighbors(SIZE - 1, SIZE - 1);
  
  assert(n00 === 3, '(0,0) 有3个环绕邻居');
  assert(nLastLast === 3, '(' + (SIZE-1) + ',' + (SIZE-1) + ') 有3个环绕邻居');
}

async function testCornerStability() {
  console.log('\n=== 测试 2: 四角稳定结构 (Worker) ===');
  
  const engine = new LifeEngine(SIZE, SIZE, 3);
  await engine.init();
  engine.clear();

  engine.setCell(0, 0, true);
  engine.setCell(SIZE - 1, 0, true);
  engine.setCell(0, SIZE - 1, true);
  engine.setCell(SIZE - 1, SIZE - 1, true);

  await new Promise(resolve => {
    engine.evolve(() => {
      const grid = engine.grid;
      const totalAlive = grid.cells.reduce((s, c) => s + c, 0);
      
      assert(totalAlive === 4, '四角结构稳定 (活细胞=' + totalAlive + ')');
      assert(grid.get(0, 0) === 1, '(0,0) 存活');
      assert(grid.get(SIZE - 1, SIZE - 1) === 1, '(' + (SIZE-1) + ',' + (SIZE-1) + ') 存活');
      
      engine.shutdown().then(resolve);
    });
  });
}

async function testVerticalWrap() {
  console.log('\n=== 测试 3: 垂直环绕 - 邻居计数验证 ===');
  
  const engine = new LifeEngine(SIZE, SIZE, 4);
  await engine.init();
  engine.clear();

  engine.setCell(5, SIZE - 1, true);

  const grid = engine.grid;
  const nAbove = grid.countNeighbors(5, 0);
  
  assert(nAbove === 1, '(5,0) 能看到底行邻居 (5,' + (SIZE-1) + '), 邻居数=' + nAbove);

  engine.setCell(4, SIZE - 1, true);
  engine.setCell(6, SIZE - 1, true);
  
  const nAbove2 = engine.grid.countNeighbors(5, 0);
  assert(nAbove2 === 3, '(5,0) 能看到底行3个环绕邻居, 邻居数=' + nAbove2);
  
  await engine.shutdown();
}

async function testBlinkerOscillation() {
  console.log('\n=== 测试 4: 闪烁灯周期验证 ===');
  
  const engine = new LifeEngine(SIZE, SIZE, 2);
  await engine.init();
  engine.clear();

  engine.setCell(4, 5, true);
  engine.setCell(5, 5, true);
  engine.setCell(6, 5, true);
  
  console.log('  初始: (4,5), (5,5), (6,5) → 水平3连');

  await new Promise(resolve => {
    engine.evolve(() => {
      const grid = engine.grid;
      const horizontal = grid.get(4, 5) && grid.get(5, 5) && grid.get(6, 5);
      const vertical = grid.get(5, 4) && grid.get(5, 5) && grid.get(5, 6);
      
      assert(!horizontal, '水平3连消失');
      assert(vertical, '变为垂直3连');
      
      engine.evolve(() => {
        const grid2 = engine.grid;
        const h2 = grid2.get(4, 5) && grid2.get(5, 5) && grid2.get(6, 5);
        assert(h2, '第2代恢复水平3连 → 周期2振荡');
        
        engine.shutdown().then(resolve);
      });
    });
  });
}

async function testEdgeBlinkerWrap() {
  console.log('\n=== 测试 5: 跨边界闪烁灯 ===');
  
  const engine = new LifeEngine(SIZE, SIZE, 3);
  await engine.init();
  engine.clear();

  engine.setCell(SIZE - 1, 5, true);
  engine.setCell(0, 5, true);
  engine.setCell(1, 5, true);
  
  console.log('  初始: (' + (SIZE-1) + ',5), (0,5), (1,5) → 跨右边界3连');

  await new Promise(resolve => {
    engine.evolve(() => {
      const grid = engine.grid;
      const v0 = grid.get(0, 4) && grid.get(0, 5) && grid.get(0, 6);
      
      assert(v0, '(0,5) 处形成垂直3连');
      
      engine.evolve(() => {
        const grid2 = engine.grid;
        const h2 = grid2.get(SIZE-1, 5) && grid2.get(0, 5) && grid2.get(1, 5);
        assert(h2, '第2代恢复水平3连 → 跨边界周期2振荡');
        engine.shutdown().then(resolve);
      });
    });
  });
}

async function testGliderConservation() {
  console.log('\n=== 测试 6: 滑翔机守恒 ===');
  
  const engine = new LifeEngine(SIZE, SIZE, 2);
  await engine.init();
  engine.clear();

  engine.setCell(1, 0, true);
  engine.setCell(2, 1, true);
  engine.setCell(0, 2, true);
  engine.setCell(1, 2, true);
  engine.setCell(2, 2, true);

  let gen = 0;
  const maxGen = 40;
  
  await new Promise(resolve => {
    const step = () => {
      engine.evolve(() => {
        gen++;
        if (gen >= maxGen) {
          let aliveCount = 0;
          for (let i = 0; i < engine.grid.cells.length; i++) {
            if (engine.grid.cells[i]) aliveCount++;
          }
          assert(aliveCount === 5, '滑翔机经过 ' + gen + ' 代后仍有5个活细胞 (实际: ' + aliveCount + ')');
          engine.shutdown().then(resolve);
        } else {
          step();
        }
      });
    };
    step();
  });
}

async function testPerformance() {
  console.log('\n=== 测试 7: 大网格性能 (1000x1000) ===');
  
  const engine = new LifeEngine(1000, 1000);
  await engine.init();
  engine.fillRandom(0.3);
  
  const FRAMES = 30;
  const startTime = Date.now();
  
  await new Promise(resolve => {
    let count = 0;
    const step = () => {
      engine.evolve(() => {
        count++;
        if (count < FRAMES) {
          step();
        } else {
          const elapsed = Date.now() - startTime;
          const fps = (FRAMES / (elapsed / 1000)).toFixed(1);
          assert(parseFloat(fps) >= 30, '1000x1000 网格 FPS=' + fps + ' >= 30');
          console.log('  ' + FRAMES + '帧耗时: ' + elapsed + 'ms, FPS: ' + fps);
          engine.shutdown().then(resolve);
        }
      });
    };
    step();
  });
}

(async () => {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  康威生命游戏 - 边界和内存修复验证  ║');
  console.log('╚══════════════════════════════════════╝');
  
  await testCornerNeighbors();
  await testCornerStability();
  await testVerticalWrap();
  await testBlinkerOscillation();
  await testEdgeBlinkerWrap();
  await testGliderConservation();
  await testPerformance();
  
  console.log('\n══════════════════════════════════════');
  console.log('总计: ' + passed + ' 通过, ' + failed + ' 失败');
  console.log('══════════════════════════════════════');
  
  process.exit(failed > 0 ? 1 : 0);
})();
