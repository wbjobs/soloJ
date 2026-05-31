const http = require('http');
const { URL } = require('url');
const config = require('./config');

const validateModelConfig = (config) => {
  const requiredFields = ['name', 'file', 'type', 'input_width', 'input_height', 'input_channels'];
  for (const field of requiredFields) {
    if (!(field in config)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }
  
  const validTypes = ['image_classification', 'emotion_detection', 'sentiment_analysis', 'custom'];
  if (!validTypes.includes(config.type)) {
    return { valid: false, error: `Invalid model type: ${config.type}` };
  }
  
  return { valid: true };
};

const reloadWasmModule = async () => {
  return new Promise((resolve) => {
    try {
      const url = new URL('/certs', config.envoyAdminUrl);
      
      const req = http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve(res.statusCode === 200);
        });
      });
      
      req.on('error', () => resolve(false));
      req.setTimeout(2000);
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    } catch (e) {
      resolve(false);
    }
  });
};

const triggerEnvoyConfigReload = async () => {
  return new Promise((resolve) => {
    try {
      const url = new URL('/clusters', config.envoyAdminUrl);
      
      const req = http.get(url, (res) => {
        resolve(res.statusCode === 200);
      });
      
      req.on('error', () => resolve(false));
      req.setTimeout(2000);
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    } catch (e) {
      resolve(false);
    }
  });
};

module.exports = {
  validateModelConfig,
  reloadWasmModule,
  triggerEnvoyConfigReload
};
