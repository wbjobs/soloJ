const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const modelsRouter = require('../routes/models');
const rulesRouter = require('../routes/rules');
const pipelinesRouter = require('../routes/pipelines');
const statsRouter = require('../routes/stats');
const metricsRouter = require('../routes/metrics');

const config = require('./config');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

app.use('/api/v1/models', modelsRouter);
app.use('/api/v1/rules', rulesRouter);
app.use('/api/v1/pipelines', pipelinesRouter);
app.use('/api/v1/stats', statsRouter);
app.use('/metrics', metricsRouter);

app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl
  });
});

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Management API server running on port ${PORT}`);
  console.log(`Models directory: ${config.modelsDir}`);
  console.log(`Config directory: ${config.configDir}`);
});

module.exports = app;
