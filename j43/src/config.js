const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const DEFAULT_CONFIG = {
  upstreamRegistry: 'https://registry.npmmirror.com',
  port: 4873,
  cacheDB: path.join(__dirname, '..', 'data', 'cache.db'),
  vulnerabilityDB: path.join(__dirname, '..', 'data', 'vulnerability-db.json'),
  lockedVersions: {}
};

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    return { ...DEFAULT_CONFIG, ...saved, lockedVersions: { ...DEFAULT_CONFIG.lockedVersions, ...(saved.lockedVersions || {}) } };
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config) {
  const current = loadConfig();
  const merged = { ...current, ...config };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
  return merged;
}

function getUpstreamRegistry() {
  return loadConfig().upstreamRegistry;
}

function setRegistry(url) {
  return saveConfig({ upstreamRegistry: url });
}

function lockVersion(packageName, version) {
  const config = loadConfig();
  const lockedVersions = { ...config.lockedVersions, [packageName]: version };
  return saveConfig({ lockedVersions });
}

function unlockVersion(packageName) {
  const config = loadConfig();
  const lockedVersions = { ...config.lockedVersions };
  delete lockedVersions[packageName];
  return saveConfig({ lockedVersions });
}

function getLockedVersions() {
  return loadConfig().lockedVersions || {};
}

function isLocked(packageName) {
  const locked = getLockedVersions();
  return locked[packageName] || null;
}

module.exports = {
  loadConfig,
  saveConfig,
  getUpstreamRegistry,
  setRegistry,
  lockVersion,
  unlockVersion,
  getLockedVersions,
  isLocked,
  CONFIG_PATH
};
