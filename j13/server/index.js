const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const multer = require('multer');

dotenv.config();

const db = require('./db');
const roomManager = require('./rooms');
const socketHandler = require('./socket');
const annotationRoutes = require('./routes/annotations');
const exportRoutes = require('./routes/export');
const roomRoutes = require('./routes/rooms');
const sessionRoutes = require('./routes/sessions');
const { storageService } = require('./services/storage');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..', 'client')));

const upload = multer({
  storage: storageService.getMulterStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.use('/api/annotations', annotationRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/storage', express.static(storageService.getStoragePath()));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

db.init().then(() => {
  socketHandler.init(io, roomManager);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Collab 3D Review server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
