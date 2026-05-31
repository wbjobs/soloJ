const net = require('net');
const { SERVER_PORT, MESSAGE_TYPES } = require('../src/shared/constants');

function runTests() {
  console.log('=== 植物大战僵尸 网络版 - 系统测试 ===\n');

  testServerConnection();
}

function testServerConnection() {
  console.log('[测试 1] 服务器连接测试...');

  const client = net.createConnection({
    host: 'localhost',
    port: SERVER_PORT
  }, () => {
    console.log('  ✓ 成功连接到服务器');

    let buffer = '';
    let joinReceived = false;
    let stateReceived = false;

    client.on('data', (data) => {
      buffer += data.toString();
      const messages = buffer.split('\n');
      buffer = messages.pop() || '';

      for (const message of messages) {
        if (!message.trim()) continue;

        try {
          const parsed = JSON.parse(message);

          if (parsed.type === MESSAGE_TYPES.INFO && !joinReceived) {
            joinReceived = true;
            console.log('  ✓ 收到加入房间确认:', parsed.message);
            console.log('    房间ID:', parsed.roomId);

            setTimeout(() => {
              client.write(JSON.stringify({
                type: MESSAGE_TYPES.ACTION,
                action: 'place_plant',
                x: 2,
                y: 2,
                plantType: 'PEASHOOTER'
              }) + '\n');
            }, 200);
          }

          if (parsed.type === MESSAGE_TYPES.STATE && !stateReceived) {
            stateReceived = true;
            console.log('  ✓ 收到游戏状态更新');
            console.log('    分数:', parsed.state.score);
            console.log('    阳光点数:', parsed.state.sunPoints);
            console.log('    网格尺寸:', parsed.state.grid.length + 'x' + parsed.state.grid[0].length);

            const hasPlant = parsed.state.grid.some(row =>
              row.some(cell => cell !== '-')
            );
            console.log('    网格中有实体:', hasPlant);

            client.destroy();
            runTest2();
          }
        } catch (err) {
          console.error('  ✗ 解析消息失败:', err.message);
        }
      }
    });

    client.write(JSON.stringify({
      type: MESSAGE_TYPES.JOIN
    }) + '\n');
  });

  client.on('error', (err) => {
    console.error('  ✗ 连接失败:', err.message);
    process.exit(1);
  });
}

function runTest2() {
  console.log('\n[测试 2] 观战模式测试...');

  const client = net.createConnection({
    host: 'localhost',
    port: SERVER_PORT
  }, () => {
    console.log('  ✓ 成功连接到服务器');

    let buffer = '';
    let watchReceived = false;

    client.on('data', (data) => {
      buffer += data.toString();
      const messages = buffer.split('\n');
      buffer = messages.pop() || '';

      for (const message of messages) {
        if (!message.trim()) continue;

        try {
          const parsed = JSON.parse(message);

          if (parsed.type === MESSAGE_TYPES.INFO && !watchReceived) {
            watchReceived = true;
            console.log('  ✓ 收到观战确认:', parsed.message);
            console.log('    是玩家:', parsed.isPlayer);

            client.write(JSON.stringify({
              type: MESSAGE_TYPES.ACTION,
              action: 'place_plant',
              x: 0,
              y: 0,
              plantType: 'PEASHOOTER'
            }) + '\n');
          }

          if (parsed.type === MESSAGE_TYPES.ERROR) {
            console.log('  ✓ 观战者操作被拒绝 (预期行为):', parsed.message);
            client.destroy();
            console.log('\n=== 所有测试通过! ===');
            process.exit(0);
          }
        } catch (err) {
          console.error('  ✗ 解析消息失败:', err.message);
        }
      }
    });

    client.write(JSON.stringify({
      type: MESSAGE_TYPES.WATCH,
      roomId: 'TESTROOM'
    }) + '\n');
  });

  client.on('error', (err) => {
    console.error('  ✗ 连接失败:', err.message);
    process.exit(1);
  });
}

runTests();
