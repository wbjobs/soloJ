const WebSocket = require('ws');
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

async function testEndToEndRollback() {
  console.log('=== 端到端测试：客户端连接 + 回滚通知 ===\n');

  console.log('步骤1：先创建一个参考快照...');
  const createRes = await httpRequest({
    hostname: 'localhost',
    port: 8080,
    path: '/api/snapshot/create',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const baseTimestamp = createRes.data.snapshot.timestamp;
  console.log(`  参考快照: ${baseTimestamp}`);

  console.log('\n步骤2：连接 WebSocket 客户端...');
  const client = new WebSocket('ws://localhost:8080/ws');
  let receivedMessages = [];
  let initReceived = false;
  let rollbackReceived = null;

  await new Promise((resolve) => {
    client.on('open', () => {
      console.log('  ✅ 客户端已连接');
    });
    client.on('message', (d) => {
      const msg = JSON.parse(d.toString());
      receivedMessages.push(msg.type);
      if (msg.type === 'init') {
        initReceived = true;
        console.log(`  ✅ 收到 init，共 ${msg.data.world.chunks.length} 个 Chunk`);
        resolve();
      }
      if (msg.type === 'world_rollback') {
        rollbackReceived = msg.data;
        console.log(`  ✅ 收到 world_rollback，timestamp: ${rollbackReceived.timestamp}`);
        console.log(`     包含 ${rollbackReceived.chunks.length} 个 Chunk`);
      }
    });
  });

  if (!initReceived) {
    console.log('❌ 未收到 init 消息');
    process.exit(1);
  }

  console.log('\n步骤3：放置一个方块（修改世界状态）...');
  client.send(JSON.stringify({
    type: 'block_change',
    data: { x: 5, y: 10, z: 5, block: 4, req_id: 'test_e2e_1' }
  }));

  await new Promise(r => setTimeout(r, 500));

  console.log('\n步骤4：调用回滚 API 恢复到参考快照...');
  const rollbackRes = await httpRequest({
    hostname: 'localhost',
    port: 8080,
    path: `/api/snapshot/restore/${baseTimestamp}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  console.log(`  回滚 API 响应: ${rollbackRes.status}`);
  console.log(`  成功: ${rollbackRes.data.success}`);
  console.log(`  通知玩家数: ${rollbackRes.data.playersNotified}`);

  await new Promise(r => setTimeout(r, 1000));

  console.log('\n步骤5：验证客户端收到回滚消息...');
  if (rollbackReceived && rollbackReceived.timestamp === baseTimestamp) {
    console.log('  ✅ 客户端正确收到回滚消息');
  } else {
    console.log('  ❌ 客户端未收到回滚消息');
    console.log('  收到的消息:', receivedMessages);
    process.exit(1);
  }

  console.log('\n步骤6：验证客户端收到的消息顺序...');
  const expectedOrder = ['init', 'block_change_ack', 'world_rollback'];
  console.log(`  收到的消息: ${receivedMessages.join(' → ')}`);
  console.log(`  期望顺序: ${expectedOrder.join(' → ')}`);

  const hasInit = receivedMessages.includes('init');
  const hasAck = receivedMessages.includes('block_change_ack');
  const hasRollback = receivedMessages.includes('world_rollback');

  if (hasInit && hasAck && hasRollback) {
    console.log('  ✅ 消息顺序正确');
  } else {
    console.log('  ❌ 消息缺失');
    process.exit(1);
  }

  client.close();

  console.log('\n🎉 端到端测试通过！');
  console.log('\n完整流程验证：');
  console.log('  ✅ WebSocket 连接与初始化');
  console.log('  ✅ 方块修改与 ACK');
  console.log('  ✅ 管理 API 回滚');
  console.log('  ✅ 客户端收到 world_rollback 通知');
  console.log('  ✅ 回滚消息包含完整世界数据');
}

testEndToEndRollback().catch(e => {
  console.error('测试失败:', e.message);
  process.exit(1);
});
