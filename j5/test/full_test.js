const net = require('net');
const { SERVER_PORT, MESSAGE_TYPES } = require('../src/shared/constants');

let testRoomId = null;

function runFullTests() {
  console.log('=== 植物大战僵尸 网络版 - 完整系统测试 ===\n');

  test1_connectAndCreateRoom();
}

function test1_connectAndCreateRoom() {
  console.log('[测试 1] 创建房间并加入游戏...');

  const client = net.createConnection({
    host: 'localhost',
    port: SERVER_PORT
  }, () => {
    let buffer = '';
    let joinReceived = false;
    let actionResult = null;

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
            testRoomId = parsed.roomId;
            console.log('  ✓ 创建房间成功:', testRoomId);

            setTimeout(() => {
              client.write(JSON.stringify({
                type: MESSAGE_TYPES.ACTION,
                action: 'place_plant',
                x: 2,
                y: 2,
                plantType: 'PEASHOOTER'
              }) + '\n');
            }, 100);
          }

          if (parsed.type === MESSAGE_TYPES.INFO && joinReceived && parsed.success !== undefined) {
            actionResult = parsed;
            console.log('  ✓ 放置植物:', parsed.message, '- 成功:', parsed.success);

            setTimeout(() => {
              client.destroy();
              test2_watchExistingRoom();
            }, 200);
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

function test2_watchExistingRoom() {
  console.log('\n[测试 2] 观战已有房间...');

  if (!testRoomId) {
    console.log('  ✗ 没有可用的房间ID，跳过观战测试');
    process.exit(1);
  }

  const client = net.createConnection({
    host: 'localhost',
    port: SERVER_PORT
  }, () => {
    let buffer = '';
    let watchReceived = false;
    let stateReceived = false;

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
            console.log('  ✓ 观战确认:', parsed.message);
            console.log('    是玩家:', parsed.isPlayer);
          }

          if (parsed.type === MESSAGE_TYPES.STATE && !stateReceived) {
            stateReceived = true;
            console.log('  ✓ 收到游戏状态');
            console.log('    房间:', parsed.state.roomId);

            setTimeout(() => {
              client.write(JSON.stringify({
                type: MESSAGE_TYPES.ACTION,
                action: 'place_plant',
                x: 0,
                y: 0,
                plantType: 'PEASHOOTER'
              }) + '\n');
            }, 100);
          }

          if (parsed.type === MESSAGE_TYPES.ERROR) {
            console.log('  ✓ 观战者操作被正确拒绝:', parsed.message);
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
      roomId: testRoomId
    }) + '\n');
  });

  client.on('error', (err) => {
    console.error('  ✗ 连接失败:', err.message);
    process.exit(1);
  });
}

runFullTests();
