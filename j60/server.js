const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = new Map();

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.roomId = null;
    ws.peerId = null;
    ws.peerName = null;

    ws.on('message', (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch {
            return;
        }

        switch (msg.type) {
            case 'join': {
                const roomId = msg.roomId;
                ws.peerId = msg.peerId || generateId();
                ws.peerName = msg.peerName || 'Anonymous';
                ws.roomId = roomId;

                if (!rooms.has(roomId)) {
                    rooms.set(roomId, new Map());
                }
                const room = rooms.get(roomId);

                const existingPeers = [];
                for (const [pid, client] of room) {
                    if (client.readyState === 1) {
                        existingPeers.push({ peerId: pid, peerName: client.peerName });
                    }
                }

                room.set(ws.peerId, ws);

                ws.send(JSON.stringify({
                    type: 'joined',
                    peerId: ws.peerId,
                    peers: existingPeers
                }));

                for (const [pid, client] of room) {
                    if (pid !== ws.peerId && client.readyState === 1) {
                        client.send(JSON.stringify({
                            type: 'peer-joined',
                            peerId: ws.peerId,
                            peerName: ws.peerName
                        }));
                    }
                }

                console.log(`[Room ${roomId}] ${ws.peerName} (${ws.peerId}) joined. Total: ${room.size}`);
                break;
            }

            case 'offer':
            case 'answer':
            case 'candidate': {
                if (!ws.roomId) return;
                const room = rooms.get(ws.roomId);
                if (!room) return;
                const targetId = msg.targetId;
                if (!targetId) return;
                const target = room.get(targetId);
                if (target && target.readyState === 1) {
                    target.send(JSON.stringify({
                        ...msg,
                        fromId: ws.peerId
                    }));
                }
                break;
            }

            case 'leave': {
                leaveRoom(ws);
                break;
            }
        }
    });

    ws.on('close', () => {
        leaveRoom(ws);
    });

    ws.on('pong', () => {
        ws.isAlive = true;
    });
});

function leaveRoom(ws) {
    if (!ws.roomId) return;
    const room = rooms.get(ws.roomId);
    if (!room) return;

    room.delete(ws.peerId);

    for (const [pid, client] of room) {
        if (client.readyState === 1) {
            client.send(JSON.stringify({
                type: 'peer-left',
                peerId: ws.peerId,
                peerName: ws.peerName
            }));
        }
    }

    console.log(`[Room ${ws.roomId}] ${ws.peerName} (${ws.peerId}) left. Remaining: ${room.size}`);

    if (room.size === 0) {
        rooms.delete(ws.roomId);
    }

    ws.roomId = null;
    ws.peerId = null;
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => {
    clearInterval(interval);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Signaling server running at http://localhost:${PORT}`);
});
