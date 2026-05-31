const path = require('path');

const config = {
  port: process.env.PORT || 8082,
  modelsDir: process.env.MODELS_DIR || path.join(__dirname, '../../models'),
  configDir: process.env.CONFIG_DIR || path.join(__dirname, '../../config'),
  wasmModulePath: process.env.WASM_MODULE_PATH || path.join(__dirname, '../../wasm/bazel-bin/ai_gateway_filter.wasm'),
  envoyAdminUrl: process.env.ENVOY_ADMIN_URL || 'http://localhost:9901',
  maxModelSize: parseInt(process.env.MAX_MODEL_SIZE, 10) || 500 * 1024 * 1024,
  stats: {
    retentionPeriod: parseInt(process.env.STATS_RETENTION_PERIOD, 10) || 3600,
    sampleInterval: parseInt(process.env.STATS_SAMPLE_INTERVAL, 10) || 5
  }
};

module.exports = config;
