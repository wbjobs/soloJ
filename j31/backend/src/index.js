import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import sequelize from './config/database.js';
import websocketManager from './websocket/WebSocketManager.js';
import uploadRoutes from './routes/uploadRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import webrtcRoutes from './routes/webrtcRoutes.js';
import subtitleCorrectionRoutes from './routes/subtitleCorrectionRoutes.js';
import modelRoutes from './routes/modelRoutes.js';
import abTestRoutes from './routes/abTestRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import trainingRoutes from './routes/trainingRoutes.js';
import './queues/taskQueue.js';
import schedulerService from './services/schedulerService.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.NODE_ENV === 'development' ? '*' : ['http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api', uploadRoutes);
app.use('/api', taskRoutes);
app.use('/api', webrtcRoutes);
app.use('/api', subtitleCorrectionRoutes);
app.use('/api', modelRoutes);
app.use('/api', abTestRoutes);
app.use('/api', reportRoutes);
app.use('/api', trainingRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

websocketManager.init(server);

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully');
    
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('Database synchronized');
    
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

export default app;
