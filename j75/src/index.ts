import express, { Express } from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './config';
import apiRoutes from './api';
import { CollabWebSocketServer } from './websocket';
import {
  connectDatabase,
  disconnectDatabase,
  snapshotService,
  operationLogRepository,
} from './db';
import { documentManager } from './crdt';

async function createApp(): Promise<{ app: Express; server: http.Server }> {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api', apiRoutes);

  const server = http.createServer(app);

  new CollabWebSocketServer(server);

  return { app, server };
}

async function startServer(): Promise<void> {
  try {
    await connectDatabase();

    await snapshotService.loadAllDocuments();
    await operationLogRepository.initialize();

    const { server } = await createApp();

    snapshotService.start();

    server.listen(config.port, () => {
      console.log(`
=============================================
🚀 Collaborative Editor Backend
=============================================
📡 HTTP Server:    http://localhost:${config.port}
🔌 WebSocket:      ws://localhost:${config.port}
📚 Database:       MongoDB connected
⏱️  Snapshot:       Every ${config.snapshotIntervalMs}ms
📝 Docs in memory: ${documentManager.getAllMetadata().length}
=============================================
      `);
    });

    const gracefulShutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}, shutting down gracefully...`);

      snapshotService.stop();

      try {
        const count = await snapshotService.takeAllSnapshots();
        console.log(`Final snapshot complete: ${count} documents saved`);
      } catch (error) {
        console.error('Error during final snapshot:', error);
      }

      await disconnectDatabase();

      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });

      setTimeout(() => {
        console.error('Force shutdown after 10 seconds');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export { createApp, startServer };
