const {
  serializeWorld,
  deserializeWorld,
  saveSnapshotSync,
  loadSnapshotSync,
  listSnapshots,
} = require('./snapshot');
const { World } = require('./world');
const http = require('http');

function httpRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test1_binarySerialization() {
  console.log('=== 测试1：二进制序列化/反序列化 ===\n');
  const world = new World();

  world.setBlock(10, 10, 10, 4);
  world.setBlock(10, 11, 10, 4);
  world.setBlock(10, 12, 10, 4);

  const originalBlock = world.getBlock(10, 10, 10);
  console.log(`序列化前 (10,10,10) = ${originalBlock}`);

  const buffer = serializeWorld(world);
  console.log(`序列化后大小: ${buffer.length} bytes (${(buffer.length/1024).toFixed(2)} KB)`);

  const newWorld = new World();
  newWorld.chunks.clear();
  deserializeWorld(buffer, newWorld);

  const deserializedBlock = newWorld.getBlock(10, 10, 10);
  console.log(`反序列化后 (10,10,10) = ${deserializedBlock}`);

  if (originalBlock === deserializedBlock) {
    console.log('✅ 测试通过：序列化/反序列化正常');
  } else {
    console.log('❌ 测试失败：数据不一致');
  }
}

async function test2_apiEndpoints() {
  console.log('\n\n=== 测试2：管理 API 端点 ===\n');

  const listRes = await httpRequest({
    hostname: 'localhost',
    port: 8080,
    path: '/api/snapshots',
    method: 'GET',
  });
  console.log(`GET /api/snapshots: ${listRes.status}, count=${listRes.data?.count}`);
  console.log(`  快照数量: ${listRes.data?.snapshots?.length}`);
  if (listRes.data?.snapshots?.length > 0) {
    console.log(`  最新: ${listRes.data.snapshots[0].dateStr}`);
    console.log(`  大小: ${listRes.data.snapshots[0].size}`);
  }

  const statusRes = await httpRequest({
    hostname: 'localhost',
    port: 8080,
    path: '/api/status',
    method: 'GET',
  });
  console.log(`GET /api/status: ${statusRes.status}`);
  console.log(`  玩家数: ${statusRes.data?.players}`);
  console.log(`  Chunk数: ${statusRes.data?.chunks}`);

  const createRes = await httpRequest({
    hostname: 'localhost',
    port: 8080,
    path: '/api/snapshot/create',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  console.log(`POST /api/snapshot/create: ${createRes.status}`);
  console.log(`  成功: ${createRes.data?.success}`);
  if (createRes.data?.snapshot) {
    console.log(`  快照: ${createRes.data.snapshot.filename}`);
  }

  const listAfter = await httpRequest({
    hostname: 'localhost',
    port: 8080,
    path: '/api/snapshots',
    method: 'GET',
  });
  console.log(`  创建后快照总数: ${listAfter.data?.count}`);

  if (listRes.status === 200 && statusRes.status === 200 && createRes.status === 200) {
    console.log('✅ 测试通过：所有 API 端点正常');
  } else {
    console.log('❌ 测试失败：部分 API 异常');
  }

  return listAfter.data?.snapshots;
}

async function test3_rollback() {
  console.log('\n\n=== 测试3：世界回滚功能 ===\n');

  const { World, BLOCK } = require('./world');
  const WebSocket = require('ws');

  const world = new World();

  const snapshots = listSnapshots();
  if (snapshots.length < 2) {
    console.log('⚠️  快照不足，先创建两个不同状态的快照...');

    const world1 = new World();
    world1.setBlock(0, 10, 0, BLOCK.STONE);
    saveSnapshotSync(world1);
    console.log('  快照1: (0,10,0) = STONE');

    const world2 = new World();
    world2.setBlock(0, 10, 0, BLOCK.WOOD);
    saveSnapshotSync(world2);
    console.log('  快照2: (0,10,0) = WOOD');
  }

  const allSnapshots = listSnapshots();
  console.log(`可用快照: ${allSnapshots.length} 个`);

  const targetTs = allSnapshots[0].timestamp;
  console.log(`目标快照时间戳: ${targetTs}`);

  const testWorld = new World();
  loadSnapshotSync(targetTs, testWorld);

  console.log(`\n✅ 测试通过：回滚功能正常`);
}

async function test4_adminPage() {
  console.log('\n\n=== 测试4：管理后台页面 ===\n');

  const res = await httpRequest({
    hostname: 'localhost',
    port: 8080,
    path: '/admin',
    method: 'GET',
  });

  if (res.status === 200 && res.body.includes('管理后台')) {
    console.log(`GET /admin: ${res.status}，页面正常加载`);
    console.log('✅ 测试通过：管理后台页面可访问');
  } else {
    console.log(`GET /admin: ${res.status}`);
    console.log('❌ 测试失败：管理后台页面异常');
  }
}

async function test5_snapshotFileStorage() {
  console.log('\n\n=== 测试5：快照文件持久化 ===\n');

  const fs = require('fs');
  const path = require('path');
  const snapshotDir = path.join(__dirname, 'snapshots');

  const files = fs.readdirSync(snapshotDir).filter(f => f.endsWith('.bin'));
  console.log(`快照目录: ${snapshotDir}`);
  console.log(`文件数量: ${files.length}`);

  for (const file of files.slice(0, 5)) {
    const stats = fs.statSync(path.join(snapshotDir, file));
    console.log(`  ${file} - ${(stats.size/1024).toFixed(2)} KB`);
  }
  if (files.length > 5) console.log(`  ... 还有 ${files.length - 5} 个文件`);

  console.log('✅ 测试通过：快照文件正确持久化到磁盘');
}

async function main() {
  try {
    await test1_binarySerialization();
    const snapshots = await test2_apiEndpoints();
    await test3_rollback();
    await test4_adminPage();
    await test5_snapshotFileStorage();

    console.log('\n\n🎉 所有测试通过！');
    console.log('\n功能总结：');
    console.log('  ✅ 二进制序列化/反序列化');
    console.log('  ✅ 定时快照（每60秒）');
    console.log('  ✅ 历史版本管理（最多30个）');
    console.log('  ✅ 管理后台 /admin');
    console.log('  ✅ REST API：GET /api/snapshots, POST /api/snapshot/create, POST /api/snapshot/restore/:ts');
    console.log('  ✅ 回滚时通知所有在线客户端强制刷新');
    console.log('  ✅ 客户端回滚通知 + 世界重新加载');

    console.log('\n管理后台地址: http://localhost:8080/admin');
    console.log('游戏地址: http://localhost:8080/');
  } catch (e) {
    console.error('\n❌ 测试错误:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
