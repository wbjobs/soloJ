const express = require('express');
const fetch = require('node-fetch');
const { URL } = require('url');
const { loadConfig, getLockedVersions } = require('./config');
const { getCache } = require('./cache');
const { VulnerabilityScanner } = require('./audit');

class RequestDeduplicator {
  constructor() {
    this.pendingRequests = new Map();
  }

  async execute(key, fn) {
    if (this.pendingRequests.has(key)) {
      console.log(`[REQUEST MERGE] Waiting for existing request: ${key}`);
      return this.pendingRequests.get(key);
    }

    const promise = fn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  getStats() {
    return {
      pendingCount: this.pendingRequests.size
    };
  }
}

function createServer() {
  const config = loadConfig();
  const app = express();
  const cache = getCache(config.cacheDB);
  const scanner = new VulnerabilityScanner(config.vulnerabilityDB, config.lockedVersions);
  const deduplicator = new RequestDeduplicator();

  app.use(express.json({ limit: '50mb' }));

  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  app.get('/audit', (req, res) => {
    res.json({
      endpoint: '/audit',
      method: 'POST',
      description: 'Scan package-lock.json for vulnerabilities',
      usage: 'POST /audit with Content-Type: application/json and package-lock.json content as body'
    });
  });

  app.post('/audit', async (req, res) => {
    try {
      const lockData = req.body;

      if (!lockData || (!lockData.dependencies && !lockData.packages)) {
        return res.status(400).json({
          error: 'Invalid request body',
          message: 'Please provide a valid package-lock.json content'
        });
      }

      const result = scanner.scanLockFile(lockData);

      res.json({
        success: true,
        summary: {
          scanned: result.scanned,
          vulnerabilities: result.totalVulnerabilities,
          highRisk: result.highRisk,
          mediumRisk: result.mediumRisk,
          lowRisk: result.lowRisk,
          lockedPackages: result.lockedPackages.length
        },
        warnings: result.warnings,
        vulnerabilities: result.vulnerabilities,
        lockedPackages: result.lockedPackages,
        lockedWarnings: result.lockedWarnings
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  app.get('/-/ping', (req, res) => {
    res.json({
      ok: true,
      registry: 'private-npm-proxy',
      upstream: config.upstreamRegistry
    });
  });

  app.get('/:package', async (req, res) => {
    const packageName = req.params.package;
    const cacheKey = `metadata:${packageName}`;

    try {
      const cached = cache.getMetadata(packageName);
      if (cached) {
        console.log(`[CACHE HIT] metadata for ${packageName}`);
        return res.json(cached);
      }

      const result = await deduplicator.execute(cacheKey, async () => {
        const doubleCheck = cache.getMetadata(packageName);
        if (doubleCheck) {
          console.log(`[CACHE HIT AFTER WAIT] metadata for ${packageName}`);
          return { type: 'cache', data: doubleCheck };
        }

        console.log(`[CACHE MISS] fetching ${packageName} from ${config.upstreamRegistry}`);
        const upstreamUrl = `${config.upstreamRegistry}/${encodeURIComponent(packageName)}`;
        const response = await fetch(upstreamUrl, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          return {
            type: 'error',
            status: response.status,
            error: `Package not found: ${packageName}`
          };
        }

        const data = await response.json();

        const modifiedData = { ...data };
        const lockedVersions = getLockedVersions();
        const lockedVersion = lockedVersions[packageName];

        if (lockedVersion && modifiedData.versions) {
          if (modifiedData.versions[lockedVersion]) {
            console.log(`[VERSION LOCK] ${packageName} locked to ${lockedVersion}, filtering metadata`);
            const lockedVersionData = modifiedData.versions[lockedVersion];
            modifiedData.versions = {
              [lockedVersion]: lockedVersionData
            };
            modifiedData['dist-tags'] = {
              ...modifiedData['dist-tags'],
              latest: lockedVersion
            };
            modifiedData._locked = true;
            modifiedData._lockedVersion = lockedVersion;
          } else {
            console.log(`[VERSION LOCK WARNING] Locked version ${lockedVersion} not found for ${packageName}`);
          }
        }

        if (modifiedData.versions) {
          for (const [version, versionData] of Object.entries(modifiedData.versions)) {
            if (versionData.dist && versionData.dist.tarball) {
              const tarballUrl = new URL(versionData.dist.tarball);
              const tarballPath = tarballUrl.pathname;
              versionData.dist.tarball = `http://localhost:${config.port}${tarballPath}`;
            }
          }
        }

        cache.saveMetadata(packageName, modifiedData);
        console.log(`[CACHED] metadata for ${packageName}`);

        return { type: 'success', data: modifiedData };
      });

      if (result.type === 'error') {
        return res.status(result.status).json({
          error: result.error,
          upstreamStatus: result.status
        });
      }

      res.json(result.data);
    } catch (error) {
      console.error(`[ERROR] fetching ${packageName}:`, error.message);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  app.get('/:package/-/:tarball', async (req, res) => {
    const packageName = req.params.package;
    const tarballName = req.params.tarball;

    const versionMatch = tarballName.match(/-([\d.]+)\.tgz$/);
    const version = versionMatch ? versionMatch[1] : null;
    const cacheKey = `tarball:${packageName}@${version || tarballName}`;

    try {
      if (version) {
        const cachedTarball = cache.getTarball(packageName, version);
        if (cachedTarball) {
          console.log(`[CACHE HIT] tarball for ${packageName}@${version}`);
          res.set('Content-Type', 'application/octet-stream');
          res.set('Content-Disposition', `attachment; filename="${tarballName}"`);
          return res.send(cachedTarball);
        }
      }

      const result = await deduplicator.execute(cacheKey, async () => {
        if (version) {
          const doubleCheck = cache.getTarball(packageName, version);
          if (doubleCheck) {
            console.log(`[CACHE HIT AFTER WAIT] tarball for ${packageName}@${version}`);
            return { type: 'cache', data: doubleCheck };
          }
        }

        console.log(`[CACHE MISS] fetching tarball ${packageName}/${tarballName} from upstream`);

        const encodedPkg = encodeURIComponent(packageName);
        const upstreamUrl = `${config.upstreamRegistry}/${encodedPkg}/-/${tarballName}`;

        const response = await fetch(upstreamUrl);

        if (!response.ok) {
          return {
            type: 'error',
            status: response.status,
            error: `Tarball not found: ${packageName}/${tarballName}`
          };
        }

        const buffer = await response.buffer();

        if (version) {
          cache.saveTarball(packageName, version, buffer);
          console.log(`[CACHED] tarball for ${packageName}@${version}`);
        }

        return { type: 'success', data: buffer };
      });

      if (result.type === 'error') {
        return res.status(result.status).json({
          error: result.error,
          upstreamStatus: result.status
        });
      }

      res.set('Content-Type', 'application/octet-stream');
      res.set('Content-Disposition', `attachment; filename="${tarballName}"`);
      res.send(result.data);
    } catch (error) {
      console.error(`[ERROR] fetching tarball ${packageName}/${tarballName}:`, error.message);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  app.get('/:package/:version', async (req, res) => {
    const { package: packageName, version } = req.params;
    const cacheKey = `package:${packageName}@${version}`;

    try {
      const cached = cache.getPackage(packageName, version);
      if (cached) {
        console.log(`[CACHE HIT] ${packageName}@${version}`);
        return res.json(cached);
      }

      const result = await deduplicator.execute(cacheKey, async () => {
        const doubleCheck = cache.getPackage(packageName, version);
        if (doubleCheck) {
          console.log(`[CACHE HIT AFTER WAIT] ${packageName}@${version}`);
          return { type: 'cache', data: doubleCheck };
        }

        console.log(`[CACHE MISS] fetching ${packageName}@${version} from upstream`);
        const upstreamUrl = `${config.upstreamRegistry}/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}`;
        const response = await fetch(upstreamUrl);

        if (!response.ok) {
          return {
            type: 'error',
            status: response.status,
            error: `Version not found: ${packageName}@${version}`
          };
        }

        const data = await response.json();

        if (data.dist && data.dist.tarball) {
          const tarballUrl = new URL(data.dist.tarball);
          const tarballPath = tarballUrl.pathname;
          data.dist.tarball = `http://localhost:${config.port}${tarballPath}`;
        }

        cache.savePackage(packageName, version, data);
        console.log(`[CACHED] ${packageName}@${version}`);

        return { type: 'success', data: data };
      });

      if (result.type === 'error') {
        return res.status(result.status).json({
          error: result.error,
          upstreamStatus: result.status
        });
      }

      res.json(result.data);
    } catch (error) {
      console.error(`[ERROR] fetching ${packageName}@${version}:`, error.message);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  return { app, config, cache };
}

function startServer(port) {
  const { app, config } = createServer();
  const listenPort = port || config.port;

  const server = app.listen(listenPort, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║           Private NPM Proxy Server Started                  ║
╠══════════════════════════════════════════════════════════════╣
║  Local:       http://localhost:${listenPort}                      ║
║  Upstream:    ${config.upstreamRegistry.padEnd(47)}║
║  Audit API:   POST http://localhost:${listenPort}/audit           ║
╚══════════════════════════════════════════════════════════════╝

To use this proxy with npm:
  npm config set registry http://localhost:${listenPort}

To revert:
  npm config set registry https://registry.npmjs.org
`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createServer,
  startServer
};
