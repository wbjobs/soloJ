const EventEmitter = require('events');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const LASParser = require('../parsers/LASParser');
const { Octree } = require('../octree');
const dracoCompressor = require('../compression/draco');
const s3Storage = require('../storage/s3');
const PointCloud = require('../models/PointCloud');
const Chunk = require('../models/Chunk');
const config = require('../config');

class PointCloudProcessor extends EventEmitter {
  constructor() {
    super();
    this.memoryLimitBytes = config.pointCloud.memoryLimitGB * 1024 * 1024 * 1024;
    this.maxPointsPerChunk = config.pointCloud.maxPointsPerChunk;
    this.maxLODLevel = config.pointCloud.maxLODLevel;
  }

  _checkMemory() {
    const used = process.memoryUsage().heapUsed;
    return used < this.memoryLimitBytes * 0.8;
  }

  async processLASFile(filePath, options = {}) {
    const { name = path.basename(filePath, '.las') } = options;

    let pointCloudDoc = null;
    const tempFiles = [];

    try {
      this.emit('status', { phase: 'parsing', progress: 0, message: 'Parsing LAS header...' });

      const parser = new LASParser(filePath);
      const header = await parser.parseHeader();
      const bounds = parser.getBounds();
      const attributes = parser.getAttributes();
      const totalPoints = parser.getPointCount();

      pointCloudDoc = await PointCloud.create({
        name,
        totalPoints,
        bounds,
        attributes,
        status: 'processing',
        maxLODLevel: 0,
      });

      this.emit('status', {
        phase: 'building_octree',
        progress: 5,
        message: `Building octree for ${totalPoints.toLocaleString()} points...`,
        pointCloudId: pointCloudDoc._id,
      });

      const octree = new Octree(bounds, {
        maxPointsPerNode: this.maxPointsPerChunk,
        maxDepth: this.maxLODLevel,
      });

      let processedPoints = 0;
      const batchSize = 50000;

      await parser.streamPoints(async (batch, current, total) => {
        octree.insertBatch(batch);
        processedPoints += batch.length;

        const progress = 5 + Math.floor((processedPoints / total) * 45);
        this.emit('status', {
          phase: 'building_octree',
          progress,
          message: `Inserted ${processedPoints.toLocaleString()} points into octree...`,
          pointCloudId: pointCloudDoc._id,
        });

        if (!this._checkMemory()) {
          global.gc && global.gc();
        }
      }, { batchSize });

      const stats = octree.getStats();
      this.emit('status', {
        phase: 'octree_complete',
        progress: 50,
        message: `Octree built: ${stats.totalNodes} nodes, ${stats.totalLeafNodes} leaves, max depth ${stats.maxDepth}`,
        pointCloudId: pointCloudDoc._id,
        stats,
      });

      const maxActualLevel = stats.maxDepth;
      pointCloudDoc.maxLODLevel = maxActualLevel;
      await pointCloudDoc.save();

      this.emit('status', {
        phase: 'generating_lod',
        progress: 55,
        message: `Generating LOD levels (0 to ${maxActualLevel})...`,
        pointCloudId: pointCloudDoc._id,
      });

      for (let lodLevel = 0; lodLevel <= maxActualLevel; lodLevel++) {
        const lodProgress = 55 + Math.floor(((lodLevel + 1) / (maxActualLevel + 1)) * 40);
        this.emit('status', {
          phase: 'generating_lod',
          progress: lodProgress,
          message: `Processing LOD level ${lodLevel}/${maxActualLevel}...`,
          pointCloudId: pointCloudDoc._id,
          lodLevel,
        });

        const nodes = octree.getNodesAtLevel(lodLevel);
        const samplingFactor = Math.pow(2, maxActualLevel - lodLevel);

        for (const node of nodes) {
          if (node.pointCount === 0) continue;

          const targetPointCount = Math.ceil(node.pointCount / Math.max(1, samplingFactor));
          const points = await this._collectPointsWithSampling(node, targetPointCount);

          if (points.length === 0) continue;

          const s3Key = `${pointCloudDoc._id}/lod${lodLevel}/${node.key}.drc`;

          const compressed = await dracoCompressor.compressPointCloud(points, {
            compressionLevel: 7,
            positionQuantizationBits: Math.max(10, 14 - lodLevel),
          });

          await s3Storage.upload(s3Key, compressed.buffer, 'application/octet-stream');

          await Chunk.create({
            pointCloudId: pointCloudDoc._id,
            lodLevel,
            octreeKey: node.key,
            bounds: node.bounds,
            pointCount: points.length,
            s3Key,
            compressedSize: compressed.compressedSize,
            originalSize: compressed.originalSize,
            hasRGB: compressed.hasRGB,
            hasIntensity: compressed.hasIntensity,
          });

          global.gc && global.gc();
        }
      }

      pointCloudDoc.status = 'ready';
      await pointCloudDoc.save();

      this.emit('status', {
        phase: 'complete',
        progress: 100,
        message: 'Processing complete!',
        pointCloudId: pointCloudDoc._id,
      });

      return {
        pointCloudId: pointCloudDoc._id,
        totalPoints,
        maxLODLevel: maxActualLevel,
        bounds,
      };

    } catch (error) {
      console.error('Processing error:', error);

      if (pointCloudDoc) {
        pointCloudDoc.status = 'failed';
        pointCloudDoc.errorMessage = error.message;
        await pointCloudDoc.save();
      }

      throw error;

    } finally {
      for (const file of tempFiles) {
        try { fs.unlinkSync(file); } catch (e) {}
      }
      global.gc && global.gc();
    }
  }

  async _collectPointsWithSampling(node, targetCount, result = []) {
    if (node.points) {
      if (node.points.length <= targetCount || targetCount === 0) {
        result.push(...node.points);
      } else {
        const step = Math.ceil(node.points.length / targetCount);
        for (let i = 0; i < node.points.length && result.length < targetCount; i += step) {
          result.push(node.points[i]);
        }
      }
    } else if (node.children) {
      const childrenWithPoints = node.children.filter(c => c.pointCount > 0);
      if (childrenWithPoints.length === 0) return result;

      const pointsPerChild = Math.ceil(targetCount / childrenWithPoints.length);
      for (const child of childrenWithPoints) {
        if (result.length >= targetCount) break;
        await this._collectPointsWithSampling(child, pointsPerChild, result);
      }
    }
    return result;
  }

  async getPointCloudInfo(pointCloudId) {
    const doc = await PointCloud.findById(pointCloudId);
    if (!doc) throw new Error('Point cloud not found');
    return doc.toObject();
  }

  async listPointClouds(options = {}) {
    const { skip = 0, limit = 50, status } = options;
    const query = status ? { status } : {};
    return PointCloud.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async getChunksForCamera(pointCloudId, cameraPosition, viewFrustum, options = {}) {
    const { minLOD = 0, maxLOD = null } = options;

    const pointCloud = await PointCloud.findById(pointCloudId);
    if (!pointCloud) throw new Error('Point cloud not found');

    const actualMaxLOD = maxLOD !== null ? Math.min(maxLOD, pointCloud.maxLODLevel) : pointCloud.maxLODLevel;

    const chunks = [];

    for (let lodLevel = minLOD; lodLevel <= actualMaxLOD; lodLevel++) {
      const levelChunks = await Chunk.find({
        pointCloudId,
        lodLevel,
      }).lean();

      for (const chunk of levelChunks) {
        const distance = this._distanceToChunk(cameraPosition, chunk.bounds);
        const lodThreshold = this._getLODThreshold(lodLevel, pointCloud.bounds);

        if (distance <= lodThreshold * 2 && this._isInFrustum(chunk.bounds, viewFrustum)) {
          chunks.push({
            ...chunk,
            distance,
            targetLOD: this._getOptimalLOD(distance, pointCloud.maxLODLevel, pointCloud.bounds),
          });
        }
      }
    }

    return chunks.sort((a, b) => a.distance - b.distance);
  }

  _distanceToChunk(position, bounds) {
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;

    const dx = position.x - centerX;
    const dy = position.y - centerY;
    const dz = position.z - centerZ;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  _getLODThreshold(lodLevel, bounds) {
    const size = Math.max(
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
      bounds.maxZ - bounds.minZ
    );
    return size / Math.pow(2, lodLevel);
  }

  _getOptimalLOD(distance, maxLOD, bounds) {
    const size = Math.max(
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
      bounds.maxZ - bounds.minZ
    );

    for (let lod = 0; lod <= maxLOD; lod++) {
      const threshold = this._getLODThreshold(lod, bounds) * 2;
      if (distance < threshold) {
        return Math.min(lod, maxLOD);
      }
    }
    return maxLOD;
  }

  _isInFrustum(bounds, frustum) {
    if (!frustum || !frustum.planes) return true;

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const radius = Math.max(
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
      bounds.maxZ - bounds.minZ
    ) / 2;

    for (const plane of frustum.planes) {
      const distance = plane.normal.x * centerX + plane.normal.y * centerY + plane.normal.z * centerZ + plane.constant;
      if (distance < -radius) {
        return false;
      }
    }
    return true;
  }

  async getChunkData(chunkId) {
    const chunk = await Chunk.findById(chunkId);
    if (!chunk) throw new Error('Chunk not found');

    const data = await s3Storage.download(chunk.s3Key);
    return {
      chunk: chunk.toObject(),
      buffer: data.Body,
    };
  }

  async getChunkDataByKey(pointCloudId, lodLevel, octreeKey) {
    const chunk = await Chunk.findOne({ pointCloudId, lodLevel, octreeKey });
    if (!chunk) throw new Error('Chunk not found');

    const data = await s3Storage.download(chunk.s3Key);
    return {
      chunk: chunk.toObject(),
      buffer: data.Body,
    };
  }

  async deletePointCloud(pointCloudId) {
    const pointCloud = await PointCloud.findById(pointCloudId);
    if (!pointCloud) throw new Error('Point cloud not found');

    const chunks = await Chunk.find({ pointCloudId });
    const s3Keys = chunks.map(c => c.s3Key);

    if (s3Keys.length > 0) {
      await s3Storage.deleteMultiple(s3Keys);
    }

    await Chunk.deleteMany({ pointCloudId });
    await PointCloud.findByIdAndDelete(pointCloudId);

    return { deleted: true, chunkCount: chunks.length };
  }
}

const processor = new PointCloudProcessor();
module.exports = processor;
module.exports.PointCloudProcessor = PointCloudProcessor;
