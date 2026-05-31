const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const path = require('path');
const TimeSeriesDB = require('./TimeSeriesDB');
const ThrottledEmitter = require('./ThrottledEmitter');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const db = new TimeSeriesDB(60);
const emitter = new ThrottledEmitter(io, {
  chartIntervalMs: 1000,
  deviceListIntervalMs: 5000,
  statsIntervalMs: 1000
});

app.use(cors());
app.use(express.json());

app.post('/api/ingest', (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid data format. Expected { data: [...] }' });
    }

    db.insertBatch(data);

    emitter.onIngest(db);

    res.json({
      success: true,
      received: data.length,
      totalDevices: db.getDeviceCount(),
      totalRecords: db.getTotalRecords()
    });
  } catch (error) {
    console.error('Ingest error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/devices', (req, res) => {
  res.json({ devices: db.getAllDeviceStats() });
});

app.get('/api/devices/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  res.json(db.getDeviceStats(deviceId));
});

app.get('/api/temperature/history', (req, res) => {
  const { limit = 60 } = req.query;
  const data = db.getAggregatedLatest('temperature', parseInt(limit));
  res.json({ data });
});

app.get('/api/humidity/history', (req, res) => {
  const { limit = 60 } = req.query;
  const data = db.getAggregatedLatest('humidity', parseInt(limit));
  res.json({ data });
});

app.get('/api/devices/:deviceId/temperature', (req, res) => {
  const { deviceId } = req.params;
  const { limit = 60, startTime } = req.query;
  const start = startTime ? parseInt(startTime) : Date.now() - 60000;
  const data = db.query(deviceId, 'temperature', start);
  res.json({ data: data.slice(-parseInt(limit)) });
});

app.get('/api/stats', (req, res) => {
  res.json({
    deviceCount: db.getDeviceCount(),
    totalRecords: db.getTotalRecords(),
    lastUpdate: Date.now()
  });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  emitter.emitInitialData(socket, db);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.use(express.static(path.join(__dirname, '../frontend')));

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`IoT Dashboard Server running on port ${PORT}`);
  console.log(`HTTP API: http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}`);
  console.log(`Throttled emission: chart=1s, deviceList=5s, stats=1s`);
});
