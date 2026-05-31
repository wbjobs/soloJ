const net = require('net');
const { SERVER_PORT, MESSAGE_TYPES } = require('../src/shared/constants');

const client = net.createConnection({
  host: 'localhost',
  port: SERVER_PORT
}, () => {
  console.log('已连接');
  
  let gameOver = false;
  
  client.on('data', (data) => {
    const messages = data.toString().split('\n').filter(m => m.trim());
    
    for (const msg of messages) {
      try {
        const parsed = JSON.parse(msg);
        console.log('收到:', parsed.type, parsed.message || '');
        
        if (parsed.type === MESSAGE_TYPES.INFO && parsed.roomId) {
          console.log('房间:', parsed.roomId);
          
          setTimeout(() => {
            console.log('发送放置植物...');
            client.write(JSON.stringify({
              type: MESSAGE_TYPES.ACTION,
              action: 'place_plant',
              sequence: 1,
              timestamp: Date.now(),
              x: 2, y: 2,
              plantType: 'PEASHOOTER'
            }) + '\n');
          }, 500);
          
          setTimeout(() => {
            console.log('发送结束游戏...');
            const msg = JSON.stringify({
              type: MESSAGE_TYPES.ADMIN,
              command: 'end_game'
            }) + '\n';
            console.log('发送消息:', msg);
            client.write(msg);
          }, 1500);
        }
        
        if (parsed.type === MESSAGE_TYPES.STATE && parsed.state.status === 'gameover') {
          if (!gameOver) {
            gameOver = true;
            console.log('游戏结束，检查录像文件...');
            setTimeout(() => {
              client.destroy();
              process.exit(0);
            }, 1000);
          }
        }
      } catch (e) {}
    }
  });
  
  client.write(JSON.stringify({
    type: MESSAGE_TYPES.JOIN
  }) + '\n');
});
