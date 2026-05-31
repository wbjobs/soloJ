const express = require('express');
const http = require('http');
const { URL } = require('url');

const config = require('../src/config');

const router = express.Router();

const statsStore = {
  inferences: new Map(),
  startTime: Date.now(),
  totalRequests: 0,
  failedRequests: 0
};

const fetchEnvoyStats = async () => {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL('/stats?format=json', config.envoyAdminUrl);
      
      const req = http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ stats: [] });
          }
        });
      });
      
      req.on('error', () => resolve({ stats: [] }));
      req.setTimeout(2000);
      req.on('timeout', () => {
        req.destroy();
        resolve({ stats: [] });
      });
    } catch (e) {
      resolve({ stats: [] });
    }
  });
};

router.get('/', async (req, res, next) => {
  try {
    const envoyStats = await fetchEnvoyStats();
    
    const inferenceStats = {};
    for (const [modelName, stats] of statsStore.inferences) {
      const uptimeSeconds = (Date.now() - stats.startTime) / 1000;
      inferenceStats[modelName] = {
        total_inferences: stats.totalInferences,
        failed_inferences: stats.failedInferences,
        total_latency_ms: stats.totalLatencyMs,
        average_latency_ms: stats.totalInferences > 0 
          ? stats.totalLatencyMs / stats.totalInferences 
          : 0,
        qps: uptimeSeconds > 0 ? stats.totalInferences / uptimeSeconds : 0,
        uptime_seconds: uptimeSeconds
      };
    }
    
    res.json({
      gateway: {
        uptime_seconds: (Date.now() - statsStore.startTime) / 1000,
        total_requests: statsStore.totalRequests,
        failed_requests: statsStore.failedRequests
      },
      models: inferenceStats,
      envoy: envoyStats.stats || []
    });
  } catch (err) {
    next(err);
  }
});

router.get('/models/:name', async (req, res, next) => {
  try {
    const modelName = req.params.name;
    const stats = statsStore.inferences.get(modelName);
    
    if (!stats) {
      return res.status(404).json({ error: 'Model stats not found' });
    }
    
    const uptimeSeconds = (Date.now() - stats.startTime) / 1000;
    
    res.json({
      model: modelName,
      total_inferences: stats.totalInferences,
      failed_inferences: stats.failedInferences,
      total_latency_ms: stats.totalLatencyMs,
      average_latency_ms: stats.totalInferences > 0 
        ? stats.totalLatencyMs / stats.totalInferences 
        : 0,
      qps: uptimeSeconds > 0 ? stats.totalInferences / uptimeSeconds : 0,
      uptime_seconds: uptimeSeconds,
      recent_latencies: stats.recentLatencies || []
    });
  } catch (err) {
    next(err);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    let totalInferences = 0;
    let totalFailed = 0;
    let totalLatency = 0;
    let modelsCount = 0;
    
    for (const [, stats] of statsStore.inferences) {
      totalInferences += stats.totalInferences;
      totalFailed += stats.failedInferences;
      totalLatency += stats.totalLatencyMs;
      modelsCount++;
    }
    
    const uptimeSeconds = (Date.now() - statsStore.startTime) / 1000;
    
    res.json({
      uptime_seconds: uptimeSeconds,
      models_loaded: modelsCount,
      total_inferences: totalInferences,
      total_failed: totalFailed,
      average_latency_ms: totalInferences > 0 ? totalLatency / totalInferences : 0,
      overall_qps: uptimeSeconds > 0 ? totalInferences / uptimeSeconds : 0,
      success_rate: totalInferences > 0 
        ? ((totalInferences - totalFailed) / totalInferences * 100).toFixed(2) 
        : '100.00'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/report', async (req, res, next) => {
  try {
    const { model_name, latency_ms, success, error } = req.body;
    
    if (!model_name) {
      return res.status(400).json({ error: 'model_name is required' });
    }
    
    if (!statsStore.inferences.has(model_name)) {
      statsStore.inferences.set(model_name, {
        startTime: Date.now(),
        totalInferences: 0,
        failedInferences: 0,
        totalLatencyMs: 0,
        recentLatencies: []
      });
    }
    
    const stats = statsStore.inferences.get(model_name);
    stats.totalInferences++;
    
    if (!success) {
      stats.failedInferences++;
    } else {
      stats.totalLatencyMs += latency_ms || 0;
      stats.recentLatencies.push(latency_ms || 0);
      if (stats.recentLatencies.length > 100) {
        stats.recentLatencies.shift();
      }
    }
    
    statsStore.totalRequests++;
    if (!success) {
      statsStore.failedRequests++;
    }
    
    res.json({ status: 'reported' });
  } catch (err) {
    next(err);
  }
});

router.delete('/reset', async (req, res, next) => {
  try {
    statsStore.inferences.clear();
    statsStore.startTime = Date.now();
    statsStore.totalRequests = 0;
    statsStore.failedRequests = 0;
    
    res.json({ message: 'All statistics reset successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
