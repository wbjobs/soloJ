const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = '../client/index.html';
  } else {
    filePath = '../client' + req.url;
  }

  const extname = path.extname(filePath);
  let contentType = 'text/html';
  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if(error.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

const wss = new WebSocket.Server({ server });

const rooms = new Map();
const userColors = new Map();
const roomModels = new Map();

function generateUserId() {
  return 'user_' + Math.random().toString(36).substr(2, 9);
}

function generateColor() {
  const colors = [
    0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4,
    0xffeaa7, 0xdfe6e9, 0xff7675, 0x74b9ff,
    0xa29bfe, 0x00b894, 0xe17055, 0xfdcb6e
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function broadcastToRoom(roomId, message, excludeId = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  room.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.userId !== excludeId) {
      client.send(JSON.stringify(message));
    }
  });
}

wss.on('connection', (ws) => {
  ws.userId = generateUserId();
  ws.color = generateColor();
  ws.roomId = null;
  
  userColors.set(ws.userId, ws.color);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'join':
          const roomId = message.roomId || 'default';
          ws.roomId = roomId;
          
          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
          }
          rooms.get(roomId).add(ws);
          
          const roomUsers = [];
          rooms.get(roomId).forEach(client => {
            roomUsers.push({
              userId: client.userId,
              color: client.color
            });
          });
          
          const roomModel = roomModels.get(roomId);
          
          ws.send(JSON.stringify({
            type: 'joined',
            userId: ws.userId,
            color: ws.color,
            roomId: roomId,
            users: roomUsers,
            modelData: roomModel ? roomModel.data : null,
            modelTransform: roomModel ? roomModel.transform : null
          }));
          
          broadcastToRoom(roomId, {
            type: 'userJoined',
            userId: ws.userId,
            color: ws.color
          }, ws.userId);
          break;
          
        case 'drawStart':
          if (ws.roomId) {
            broadcastToRoom(ws.roomId, {
              type: 'drawStart',
              userId: ws.userId,
              color: ws.color,
              lineId: message.lineId,
              point: message.point
            }, ws.userId);
          }
          break;
          
        case 'drawPoint':
          if (ws.roomId) {
            broadcastToRoom(ws.roomId, {
              type: 'drawPoint',
              userId: ws.userId,
              color: ws.color,
              lineId: message.lineId,
              point: message.point
            }, ws.userId);
          }
          break;
          
        case 'drawEnd':
          if (ws.roomId) {
            broadcastToRoom(ws.roomId, {
              type: 'drawEnd',
              userId: ws.userId,
              lineId: message.lineId
            }, ws.userId);
          }
          break;
          
        case 'clear':
          if (ws.roomId) {
            broadcastToRoom(ws.roomId, {
              type: 'clear',
              userId: ws.userId
            }, ws.userId);
          }
          break;
          
        case 'modelUpload':
          if (ws.roomId) {
            roomModels.set(ws.roomId, {
              data: message.modelData,
              transform: null,
              uploaderId: ws.userId
            });
            broadcastToRoom(ws.roomId, {
              type: 'modelUpload',
              userId: ws.userId,
              modelData: message.modelData
            }, ws.userId);
          }
          break;
          
        case 'modelSync':
          if (ws.roomId && message.targetUserId) {
            const room = rooms.get(ws.roomId);
            if (room) {
              room.forEach(client => {
                if (client.userId === message.targetUserId && client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'modelSync',
                    targetUserId: message.targetUserId,
                    modelData: message.modelData,
                    modelTransform: message.modelTransform
                  }));
                }
              });
            }
          }
          break;
          
        case 'modelTransform':
          if (ws.roomId) {
            const roomModel = roomModels.get(ws.roomId);
            if (roomModel) {
              roomModel.transform = message.transform;
            }
            broadcastToRoom(ws.roomId, {
              type: 'modelTransform',
              userId: ws.userId,
              transform: message.transform
            }, ws.userId);
          }
          break;
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    if (ws.roomId) {
      const room = rooms.get(ws.roomId);
      if (room) {
        room.delete(ws);
        if (room.size === 0) {
          rooms.delete(ws.roomId);
        } else {
          broadcastToRoom(ws.roomId, {
            type: 'userLeft',
            userId: ws.userId
          });
        }
      }
    }
    userColors.delete(ws.userId);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
