import http from 'http';
import app from './app.js';
import sequelize from './config/database.js';
import { initBucket } from './config/minio.js';
import { setupSocket } from './sockets/index.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully');

    await sequelize.sync({ alter: true });
    console.log('Database models synchronized');

    await initBucket();
    console.log('MinIO bucket initialized');

    const server = http.createServer(app);
    setupSocket(server);

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
