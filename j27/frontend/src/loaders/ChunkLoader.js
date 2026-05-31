import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

class ChunkLoader {
  constructor() {
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

    this.cache = new Map();
    this.loadingPromises = new Map();
    this.maxCacheSize = 300;
    this.requestTimeout = 30000;
    this.maxRetries = 2;
  }

  async loadChunk(pointCloudId, lodLevel, octreeKey) {
    const key = `${pointCloudId}-${lodLevel}-${octreeKey}`;

    if (this.cache.has(key)) {
      const entry = this.cache.get(key);
      entry.lastUsed = Date.now();
      return entry.data;
    }

    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key);
    }

    const promise = this._loadWithRetry(pointCloudId, lodLevel, octreeKey, key);
    this.loadingPromises.set(key, promise);

    try {
      const result = await promise;
      this._addToCache(key, result);
      return result;
    } finally {
      this.loadingPromises.delete(key);
    }
  }

  async _loadWithRetry(pointCloudId, lodLevel, octreeKey, cacheKey) {
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this._loadChunkInternal(pointCloudId, lodLevel, octreeKey, cacheKey);
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError;
  }

  async _loadChunkInternal(pointCloudId, lodLevel, octreeKey, cacheKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(
        `/api/pointcloud/${pointCloudId}/chunks/${lodLevel}/${octreeKey}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to load chunk`);
      }

      const chunkDataHeader = response.headers.get('X-Chunk-Data');
      const chunkMetadata = chunkDataHeader ? JSON.parse(chunkDataHeader) : null;

      const buffer = await response.arrayBuffer();

      const geometry = await this._decodeDraco(buffer);

      return {
        geometry,
        metadata: chunkMetadata,
        cacheKey,
        bounds: chunkMetadata?.bounds ? JSON.parse(chunkMetadata.bounds) : null,
      };

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async _decodeDraco(buffer) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Draco decoding timeout'));
      }, 60000);

      this.dracoLoader.parse(
        buffer,
        (geometry) => {
          clearTimeout(timeout);
          resolve(geometry);
        },
        (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      );
    });
  }

  _addToCache(key, value) {
    if (this.cache.size >= this.maxCacheSize) {
      this._evictLRU();
    }
    this.cache.set(key, {
      data: value,
      lastUsed: Date.now(),
    });
  }

  _evictLRU() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      if (entry && entry.data && entry.data.geometry) {
        entry.data.geometry.dispose();
      }
      this.cache.delete(oldestKey);
    }
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      loading: this.loadingPromises.size,
    };
  }

  clearCache() {
    for (const [key, entry] of this.cache) {
      if (entry && entry.data && entry.data.geometry) {
        entry.data.geometry.dispose();
      }
    }
    this.cache.clear();
    this.loadingPromises.clear();
  }

  dispose() {
    this.clearCache();
    this.dracoLoader.dispose();
  }
}

export default new ChunkLoader();
