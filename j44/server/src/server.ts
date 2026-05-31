import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import http from 'http';
import { WebSocketServer } from 'ws';
import { setupYjsServer } from './utils/yjs-server';
import snippetsRouter from './routes/snippets';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codeshare';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

export let isMongoDBConnected = false;

app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true
}));

app.use(express.json());

app.get('/health', (_req: express.Request, res: express.Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mongodb: isMongoDBConnected ? 'connected' : 'disconnected (memory mode)'
  });
});

app.use('/api/snippets', snippetsRouter);

setupYjsServer(wss);

mongoose.connect(MONGODB_URI)
  .then(() => {
    isMongoDBConnected = true;
    console.log('Connected to MongoDB');
    (global as any).isMongoDBConnected = true;
  })
  .catch((err) => {
    isMongoDBConnected = false;
    (global as any).isMongoDBConnected = false;
    console.warn('MongoDB connection failed, running in memory mode:', err.message);
    console.warn('Data will not be persisted between server restarts');
  });

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
