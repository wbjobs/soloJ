const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');

const config = require('./config');
const { connectDB } = require('./db');
const s3Storage = require('./storage/s3');
const pointcloudRoutes = require('./routes/pointcloud');
const classificationRoutes = require('./routes/classification');
const processor = require('./processing/PointCloudProcessor');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/pointcloud', pointcloudRoutes);
app.use('/api/classification', classificationRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

async function startServer() {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();

    console.log('Initializing S3 storage...');
    await s3Storage.ensureBucket();

    server.listen(config.port, () => {
      console.log(`Server running on http://localhost:${config.port}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

startServer();
