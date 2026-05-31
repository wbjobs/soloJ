import * as THREE from 'three';
import { pointCloudVertexShader, pointCloudFragmentShader } from '../shaders/pointCloudShaders.js';
import chunkLoader from '../loaders/ChunkLoader.js';
import api from '../api/api.js';

class PointCloudRenderer {
  constructor(scene) {
    this.scene = scene;
    this.chunks = new Map();
    this.pendingRequests = new Map();
    this.requestQueue = [];
    this.pointCloudId = null;
    this.pointCloudInfo = null;
    this.maxLOD = 10;
    this.minLOD = 0;
    this.pointSize = 2;
    this.coloringMode = 0;

    this.queryDebounceTimer = null;
    this.queryDebounceDelay = 500;
    this.minQueryInterval = 1000;
    this.lastQueryTime = 0;
    this.cameraStableTime = 0;
    this.cameraMoveThreshold = 0.005;

    this.lastCameraPosition = new THREE.Vector3();
    this.lastCameraQuaternion = new THREE.Quaternion();

    this.maxConcurrentRequests = 4;
    this.activeRequests = 0;

    this.categoryFilter = null;
    this.hasCategoryFilter = 0;

    this.stats = {
      pointsRendered: 0,
      chunksLoaded: 0,
      pendingRequests: 0,
    };

    this.material = new THREE.ShaderMaterial({
      vertexShader: pointCloudVertexShader,
      fragmentShader: pointCloudFragmentShader,
      uniforms: {
        uPointSize: { value: this.pointSize },
        uColoringMode: { value: this.coloringMode },
        uMinHeight: { value: 0 },
        uMaxHeight: { value: 100 },
        uMinIntensity: { value: 0 },
        uMaxIntensity: { value: 255 },
        uCategoryFilter: { value: new Int32Array([0, 1, 2, 3, 4, 5, 6]) },
        uHasCategoryFilter: { value: 0 },
      },
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }

  async loadPointCloud(pointCloudId) {
    this.clear();
    this.pointCloudId = pointCloudId;

    this.pointCloudInfo = await api.getPointCloud(pointCloudId);

    this.material.uniforms.uMinHeight.value = this.pointCloudInfo.bounds.minZ;
    this.material.uniforms.uMaxHeight.value = this.pointCloudInfo.bounds.maxZ;

    return this.pointCloudInfo;
  }

  setColoringMode(mode) {
    const modeMap = { height: 0, intensity: 1, category: 2, rgb: 3 };
    this.coloringMode = modeMap[mode] !== undefined ? modeMap[mode] : 0;
    this.material.uniforms.uColoringMode.value = this.coloringMode;
  }

  setPointSize(size) {
    this.pointSize = size;
    this.material.uniforms.uPointSize.value = size;
  }

  setMaxLOD(level) {
    this.maxLOD = level;
  }

  setCategoryFilter(visibleCategories) {
    if (!visibleCategories || visibleCategories.length === 0) {
      this.categoryFilter = null;
      this.hasCategoryFilter = 0;
      this.material.uniforms.uHasCategoryFilter.value = 0;
      return;
    }

    const filter = new Int32Array(7);
    for (let i = 0; i < 7; i++) {
      filter[i] = i < visibleCategories.length ? visibleCategories[i] : -1;
    }

    this.categoryFilter = visibleCategories;
    this.hasCategoryFilter = 1;
    this.material.uniforms.uCategoryFilter.value = filter;
    this.material.uniforms.uHasCategoryFilter.value = 1;
  }

  clearCategoryFilter() {
    this.setCategoryFilter(null);
  }

  update(camera, renderer) {
    if (!this.pointCloudId) return;

    const isCameraStable = this._checkCameraStability(camera);

    if (isCameraStable) {
      this.cameraStableTime += 16;
    } else {
      this.cameraStableTime = 0;
    }

    const now = Date.now();
    const timeSinceLastQuery = now - this.lastQueryTime;

    if (timeSinceLastQuery >= this.minQueryInterval && this.cameraStableTime >= 100) {
      this._debouncedQueryChunks(camera);
    }

    this._processRequestQueue();
  }

  _checkCameraStability(camera) {
    const positionDelta = camera.position.distanceTo(this.lastCameraPosition);
    const quaternionDelta = camera.quaternion.angleTo(this.lastCameraQuaternion);

    const boundsSize = this._getBoundsSize();
    const isStable = positionDelta < boundsSize * this.cameraMoveThreshold &&
                     quaternionDelta < 0.01;

    if (!isStable) {
      this.lastCameraPosition.copy(camera.position);
      this.lastCameraQuaternion.copy(camera.quaternion);
    }

    return isStable;
  }

  _debouncedQueryChunks(camera) {
    if (this.queryDebounceTimer) {
      clearTimeout(this.queryDebounceTimer);
    }

    this.queryDebounceTimer = setTimeout(() => {
      this._queryAndUpdateChunks(camera);
    }, this.queryDebounceDelay);
  }

  async _queryAndUpdateChunks(camera) {
    const now = Date.now();
    if (now - this.lastQueryTime < this.minQueryInterval) {
      return;
    }
    this.lastQueryTime = now;

    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);

    const viewFrustum = {
      planes: frustum.planes.map(p => ({
        normal: { x: p.normal.x, y: p.normal.y, z: p.normal.z },
        constant: p.constant,
      })),
    };

    try {
      const chunksToLoad = await api.queryChunks(
        this.pointCloudId,
        { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        viewFrustum,
        { minLOD: this.minLOD, maxLOD: this.maxLOD }
      );

      this._updateChunkRequests(chunksToLoad, camera.position);
    } catch (error) {
      console.error('Error querying chunks:', error);
    }
  }

  _updateChunkRequests(chunksToLoad, cameraPosition) {
    const neededChunks = new Map();

    for (const chunkInfo of chunksToLoad) {
      const octreeKey = chunkInfo.octreeKey;
      const targetLOD = chunkInfo.targetLOD;

      const existing = neededChunks.get(octreeKey);
      if (!existing || targetLOD > existing.targetLOD) {
        neededChunks.set(octreeKey, {
          ...chunkInfo,
          distance: this._calculateDistance(cameraPosition, chunkInfo.bounds),
        });
      }
    }

    const toRemove = [];
    for (const [key, chunk] of this.chunks) {
      const octreeKey = chunk.userData.octreeKey;
      if (!neededChunks.has(octreeKey)) {
        toRemove.push({ key, octreeKey });
      }
    }

    setTimeout(() => {
      for (const { key } of toRemove) {
        if (this.chunks.has(key)) {
          this._removeChunk(key);
        }
      }
    }, 2000);

    const requests = [];
    for (const [octreeKey, chunkInfo] of neededChunks) {
      const currentLOD = this._getCurrentLODForOctreeKey(octreeKey);
      const targetLOD = chunkInfo.targetLOD;

      if (currentLOD < targetLOD) {
        requests.push({
          octreeKey,
          lodLevel: targetLOD,
          distance: chunkInfo.distance,
          priority: -targetLOD * 1000 - chunkInfo.distance,
        });
      } else if (currentLOD === -1) {
        requests.push({
          octreeKey,
          lodLevel: Math.max(0, targetLOD - 1),
          distance: chunkInfo.distance,
          priority: -targetLOD * 1000 - chunkInfo.distance + 500,
        });
        requests.push({
          octreeKey,
          lodLevel: targetLOD,
          distance: chunkInfo.distance,
          priority: -targetLOD * 1000 - chunkInfo.distance,
        });
      }
    }

    requests.sort((a, b) => b.priority - a.priority);

    for (const req of requests) {
      const key = `${req.lodLevel}-${req.octreeKey}`;
      if (!this.chunks.has(key) && !this.pendingRequests.has(key)) {
        this.requestQueue.push({
          key,
          lodLevel: req.lodLevel,
          octreeKey: req.octreeKey,
          priority: req.priority,
        });
      }
    }

    this.requestQueue.sort((a, b) => b.priority - a.priority);
    this.requestQueue = this.requestQueue.slice(0, 50);

    this._updateStats();
  }

  _getCurrentLODForOctreeKey(octreeKey) {
    let maxLOD = -1;
    for (const [key, chunk] of this.chunks) {
      if (chunk.userData.octreeKey === octreeKey) {
        maxLOD = Math.max(maxLOD, chunk.userData.lodLevel);
      }
    }
    return maxLOD;
  }

  _calculateDistance(cameraPos, bounds) {
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;

    const dx = cameraPos.x - centerX;
    const dy = cameraPos.y - centerY;
    const dz = cameraPos.z - centerZ;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  _processRequestQueue() {
    while (this.activeRequests < this.maxConcurrentRequests && this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      this._loadChunkRequest(request);
    }
  }

  async _loadChunkRequest(request) {
    const { key, lodLevel, octreeKey } = request;

    if (this.chunks.has(key) || this.pendingRequests.has(key)) {
      return;
    }

    this.pendingRequests.set(key, request);
    this.activeRequests++;
    this._updateStats();

    try {
      const { geometry, bounds } = await chunkLoader.loadChunk(
        this.pointCloudId,
        lodLevel,
        octreeKey
      );

      if (!geometry.attributes.intensity) {
        const count = geometry.attributes.position.count;
        geometry.setAttribute('intensity', new THREE.Float32BufferAttribute(new Float32Array(count), 1));
      }

      if (!geometry.attributes.category) {
        const count = geometry.attributes.position.count;
        const categories = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          categories[i] = this._classifyPointByHeight(geometry.attributes.position, i, bounds);
        }
        geometry.setAttribute('category', new THREE.Float32BufferAttribute(categories, 1));
      }

      this._removeLowerLODChunks(octreeKey, lodLevel);

      const points = new THREE.Points(geometry, this.material);
      points.userData = {
        lodLevel,
        octreeKey,
        bounds,
        pointCount: geometry.attributes.position.count,
      };

      this.scene.add(points);
      this.chunks.set(key, points);

    } catch (error) {
      console.warn('Error loading chunk:', key, error.message);
    } finally {
      this.pendingRequests.delete(key);
      this.activeRequests--;
      this._updateStats();
    }
  }

  _classifyPointByHeight(positionAttribute, index, bounds) {
    const z = positionAttribute.getZ(index);
    const zMin = bounds ? bounds.minZ : 0;
    const zMax = bounds ? bounds.maxZ : 100;
    const zRange = zMax - zMin;

    if (zRange <= 0) return 6;

    const zNormalized = (z - zMin) / zRange;

    if (zNormalized < 0.02) return 0;
    if (zNormalized < 0.15) return 1;
    return 2;
  }

  _removeLowerLODChunks(octreeKey, currentLOD) {
    const toRemove = [];
    for (const [key, chunk] of this.chunks) {
      if (chunk.userData.octreeKey === octreeKey && chunk.userData.lodLevel < currentLOD) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      this._removeChunk(key);
    }
  }

  _removeChunk(key) {
    const chunk = this.chunks.get(key);
    if (chunk) {
      this.scene.remove(chunk);
      chunk.geometry.dispose();
      this.chunks.delete(key);
      this._updateStats();
    }
  }

  _updateStats() {
    this.stats.pointsRendered = 0;
    this.stats.chunksLoaded = this.chunks.size;
    this.stats.pendingRequests = this.pendingRequests.size;

    for (const chunk of this.chunks.values()) {
      this.stats.pointsRendered += chunk.userData.pointCount || 0;
    }
  }

  _getBoundsSize() {
    if (!this.pointCloudInfo) return 100;
    const b = this.pointCloudInfo.bounds;
    return Math.max(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ);
  }

  getCenter() {
    if (!this.pointCloudInfo) return new THREE.Vector3(0, 0, 0);
    const b = this.pointCloudInfo.bounds;
    return new THREE.Vector3(
      (b.minX + b.maxX) / 2,
      (b.minY + b.maxY) / 2,
      (b.minZ + b.maxZ) / 2
    );
  }

  getRadius() {
    if (!this.pointCloudInfo) return 100;
    const b = this.pointCloudInfo.bounds;
    const dx = b.maxX - b.minX;
    const dy = b.maxY - b.minY;
    const dz = b.maxZ - b.minZ;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) / 2;
  }

  getLoadedMeshes() {
    return Array.from(this.chunks.values());
  }

  getPointsInRegion(region) {
    const points = [];

    for (const chunk of this.chunks.values()) {
      const position = chunk.geometry.attributes.position;
      const bounds = chunk.userData.bounds;

      if (bounds && !this._boundsIntersect(bounds, region)) {
        continue;
      }

      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const y = position.getY(i);
        const z = position.getZ(i);

        if (x >= region.minX && x <= region.maxX &&
            y >= region.minY && y <= region.maxY &&
            z >= region.minZ && z <= region.maxZ) {
          const point = { x, y, z };

          if (chunk.geometry.attributes.intensity) {
            point.intensity = chunk.geometry.attributes.intensity.getX(i);
          }
          if (chunk.geometry.attributes.category) {
            point.category = chunk.geometry.attributes.category.getX(i);
          }

          points.push(point);
        }
      }
    }

    return points;
  }

  _boundsIntersect(a, b) {
    return !(
      a.maxX < b.minX || a.minX > b.maxX ||
      a.maxY < b.minY || a.minY > b.maxY ||
      a.maxZ < b.minZ || a.minZ > b.maxZ
    );
  }

  clear() {
    if (this.queryDebounceTimer) {
      clearTimeout(this.queryDebounceTimer);
      this.queryDebounceTimer = null;
    }

    this.requestQueue = [];
    this.pendingRequests.clear();
    this.activeRequests = 0;

    for (const key of this.chunks.keys()) {
      this._removeChunk(key);
    }
    this.chunks.clear();
    this.pointCloudId = null;
    this.pointCloudInfo = null;
    this.stats = { pointsRendered: 0, chunksLoaded: 0, pendingRequests: 0 };
  }

  dispose() {
    this.clear();
    this.material.dispose();
    chunkLoader.dispose();
  }
}

export default PointCloudRenderer;
