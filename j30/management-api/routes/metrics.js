const express = require('express');
const client = require('prom-client');

const router = express.Router();

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const inferenceDurationHistogram = new client.Histogram({
  name: 'inference_duration_seconds',
  help: 'Duration of inference requests',
  labelNames: ['model_name', 'success'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

const inferenceTotalCounter = new client.Counter({
  name: 'inference_requests_total',
  help: 'Total number of inference requests',
  labelNames: ['model_name', 'success']
});

const modelLoadGauge = new client.Gauge({
  name: 'models_loaded',
  help: 'Number of models currently loaded'
});

const activeRulesGauge = new client.Gauge({
  name: 'active_rules',
  help: 'Number of active routing rules'
});

router.get('/', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

router.post('/inference', (req, res) => {
  const { model_name, duration_seconds, success } = req.body;
  
  if (model_name && duration_seconds !== undefined) {
    inferenceDurationHistogram
      .labels(model_name, success ? 'true' : 'false')
      .observe(duration_seconds);
    
    inferenceTotalCounter
      .labels(model_name, success ? 'true' : 'false')
      .inc();
  }
  
  res.json({ status: 'recorded' });
});

router.post('/http_request', (req, res) => {
  const { method, route, status_code } = req.body;
  
  if (method && status_code) {
    httpRequestsTotal.labels(method, route || 'unknown', status_code).inc();
  }
  
  res.json({ status: 'recorded' });
});

router.post('/models_count', (req, res) => {
  const { count } = req.body;
  if (count !== undefined) {
    modelLoadGauge.set(count);
  }
  res.json({ status: 'updated' });
});

router.post('/rules_count', (req, res) => {
  const { count } = req.body;
  if (count !== undefined) {
    activeRulesGauge.set(count);
  }
  res.json({ status: 'updated' });
});

module.exports = router;
