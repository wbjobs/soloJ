const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const { nanoid } = require('nanoid');
const Annotation = require('./models/Annotation');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static('public'));

mongoose.connect('mongodb://localhost:27017/sync-score', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const rooms = new Map();
const clients = new Map();
const sequenceCounters = new Map();

function getNextSequence(scoreId) {
  if (!sequenceCounters.has(scoreId)) {
    sequenceCounters.set(scoreId, 0);
  }
  const next = sequenceCounters.get(scoreId) + 1;
  sequenceCounters.set(scoreId, next);
  return next;
}

async function initSequenceCounter() {
  const scores = await Annotation.aggregate([
    { $group: { _id: '$scoreId', maxSeq: { $max: '$sequence' } } }
  ]);
  scores.forEach(s => {
    sequenceCounters.set(s._id, s.maxSeq || 0);
  });
  console.log('Initialized sequence counters:', Object.fromEntries(sequenceCounters));
}
initSequenceCounter();

function broadcastToRoom(roomId, message, excludeId = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  const msgStr = JSON.stringify(message);
  room.members.forEach(memberId => {
    if (memberId === excludeId) return;
    const client = clients.get(memberId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msgStr);
    }
  });
}

wss.on('connection', (ws) => {
  const clientId = nanoid(8);
  clients.set(clientId, { ws, roomId: null });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const client = clients.get(clientId);
      
      switch (msg.type) {
        case 'create-room': {
          const roomId = nanoid(6);
          rooms.set(roomId, {
            id: roomId,
            hostId: clientId,
            members: new Set([clientId]),
            isPlaying: false,
            startTime: null,
            bpm: msg.bpm || 120
          });
          client.roomId = roomId;
          ws.send(JSON.stringify({ type: 'room-created', roomId, isHost: true }));
          break;
        }

        case 'join-room': {
          const room = rooms.get(msg.roomId);
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
            return;
          }
          room.members.add(clientId);
          client.roomId = msg.roomId;
          ws.send(JSON.stringify({
            type: 'room-joined',
            roomId: msg.roomId,
            isHost: room.hostId === clientId,
            bpm: room.bpm,
            isPlaying: room.isPlaying,
            startTime: room.startTime,
            members: Array.from(room.members)
          }));
          broadcastToRoom(msg.roomId, {
            type: 'member-joined',
            memberId: clientId,
            members: Array.from(room.members)
          }, clientId);
          break;
        }

        case 'offer':
        case 'answer':
        case 'ice-candidate': {
          const targetClient = clients.get(msg.targetId);
          if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
            targetClient.ws.send(JSON.stringify({
              type: msg.type,
              from: clientId,
              data: msg.data
            }));
          }
          break;
        }

        case 'beat-sync': {
          const room = rooms.get(client.roomId);
          if (room && room.hostId === clientId) {
            room.isPlaying = msg.isPlaying;
            room.startTime = msg.startTime;
            room.bpm = msg.bpm;
            broadcastToRoom(client.roomId, {
              type: 'beat-sync',
              isPlaying: msg.isPlaying,
              startTime: msg.startTime,
              bpm: msg.bpm,
              serverTime: Date.now()
            });
          }
          break;
        }

        default:
          break;
      }
    } catch (e) {
      console.error('WebSocket message error:', e);
    }
  });

  ws.on('close', () => {
    const client = clients.get(clientId);
    if (client && client.roomId) {
      const room = rooms.get(client.roomId);
      if (room) {
        room.members.delete(clientId);
        broadcastToRoom(client.roomId, {
          type: 'member-left',
          memberId: clientId,
          members: Array.from(room.members)
        });
        if (room.members.size === 0) {
          rooms.delete(client.roomId);
        }
      }
    }
    clients.delete(clientId);
  });
});

app.get('/api/annotations/:scoreId', async (req, res) => {
  try {
    const { scoreId } = req.params;
    const { sinceSequence = 0 } = req.query;
    
    const annotations = await Annotation.find({
      scoreId,
      sequence: { $gt: parseInt(sinceSequence) || 0 }
    }).sort({ sequence: 1 }).lean();
    
    res.json({
      success: true,
      annotations,
      latestSequence: sequenceCounters.get(scoreId) || 0
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/annotations', async (req, res) => {
  try {
    const { scoreId = 'default', noteIndex, color, author, comment, clientId } = req.body;
    
    if (typeof noteIndex !== 'number' || !color) {
      return res.status(400).json({ success: false, error: 'noteIndex and color are required' });
    }

    const sequence = getNextSequence(scoreId);
    
    const annotation = new Annotation({
      scoreId,
      noteIndex,
      color,
      author: author || 'anonymous',
      comment: comment || '',
      sequence
    });

    await annotation.save();

    const room = Array.from(rooms.values()).find(r => 
      Array.from(r.members).some(m => {
        const c = clients.get(m);
        return c && m === clientId;
      })
    );
    
    if (room) {
      broadcastToRoom(room.id, {
        type: 'annotation-created',
        annotation: annotation.toObject(),
        serverTime: Date.now()
      });
    }

    res.json({
      success: true,
      annotation: annotation.toObject()
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/annotations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { color, comment, version } = req.body;

    const annotation = await Annotation.findById(id);
    if (!annotation) {
      return res.status(404).json({ success: false, error: 'Annotation not found' });
    }

    if (version !== undefined && annotation.version !== version) {
      return res.status(409).json({
        success: false,
        error: 'Conflict: annotation has been modified by another user',
        currentAnnotation: annotation.toObject()
      });
    }

    if (color) annotation.color = color;
    if (comment !== undefined) annotation.comment = comment;
    
    await annotation.save();

    const room = Array.from(rooms.values()).find(r => 
      r.members.size > 0
    );
    if (room) {
      broadcastToRoom(room.id, {
        type: 'annotation-updated',
        annotation: annotation.toObject(),
        serverTime: Date.now()
      });
    }

    res.json({
      success: true,
      annotation: annotation.toObject()
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/annotations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const annotation = await Annotation.findByIdAndDelete(id);
    
    if (!annotation) {
      return res.status(404).json({ success: false, error: 'Annotation not found' });
    }

    const room = Array.from(rooms.values()).find(r => 
      r.members.size > 0
    );
    if (room) {
      broadcastToRoom(room.id, {
        type: 'annotation-deleted',
        annotationId: id,
        scoreId: annotation.scoreId,
        serverTime: Date.now()
      });
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
