import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { RoomManager } from './utils/roomManager.js';
import { setRoomManager } from './routes/command.js';
import { terminateProcessesByRoom } from './utils/processManager.js';

const PORT = process.env.PORT || 3001;

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 15000,
  transports: ['websocket', 'polling'],
  upgradeTimeout: 30000,
});

const roomManager = new RoomManager(io);
setRoomManager(roomManager);

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join', ({ room, role }: { room: string; role: 'host' | 'viewer' }) => {
    console.log(`Socket ${socket.id} joining room ${room} as ${role}`);
    const roomData = roomManager.joinRoom(room, socket, role);
    socket.emit('history', roomData.outputHistory);
  });

  socket.on('disconnect', (reason) => {
    console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    const roomId = socket.data.roomId;
    const role = socket.data.role;

    roomManager.leaveRoom(socket);

    if (role === 'host' && roomId) {
      console.log(`Host left room ${roomId}, terminating all processes...`);
      terminateProcessesByRoom(roomId);
    }
  });

  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

io.engine.on('connection_error', (err) => {
  console.error('Connection error:', err.message);
});

httpServer.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  console.log(`WebSocket server running with heartbeat enabled`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { io, roomManager };
export default app;
