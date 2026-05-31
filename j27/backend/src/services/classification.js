const pointNetService = require('./pointnet');
const Chunk = require('../models/Chunk');
const PointCloud = require('../models/PointCloud');
const s3Storage = require('../storage/s3');
const dracoCompressor = require('../compression/draco');

class ClassificationService {
  constructor() {
    this.classificationJobs = new Map();
  }

  async classifyPointCloud(pointCloudId, options = {}) {
    const { force = false } = options;

    const pointCloud = await PointCloud.findById(pointCloudId);
    if (!pointCloud) {
      throw new Error('Point cloud not found');
    }

    if (this.classificationJobs.has(pointCloudId)) {
      return { status: 'processing', jobId: this.classificationJobs.get(pointCloudId) };
    }

    const chunks = await Chunk.find({ pointCloudId, lodLevel: 0 }).lean();

    if (chunks.length === 0) {
      throw new Error('No chunks found for classification');
    }

    const jobId = `classify-${pointCloudId}-${Date.now()}`;
    this.classificationJobs.set(pointCloudId, jobId);

    this._runClassification(pointCloudId, chunks, pointCloud.bounds)
      .then((result) => {
        this.classificationJobs.delete(pointCloudId);
      })
      .catch((error) => {
        console.error('Classification failed:', error);
        this.classificationJobs.delete(pointCloudId);
      });

    return { status: 'processing', jobId };
  }

  async _runClassification(pointCloudId, chunks, bounds) {
    const totalChunks = chunks.length;
    let processedChunks = 0;

    for (const chunk of chunks) {
      try {
        await Chunk.findByIdAndUpdate(chunk._id, { classificationStatus: 'classifying' });

        const { buffer } = await s3Storage.download(chunk.s3Key);

        const points = await dracoCompressor.decompressBufferToPoints(buffer);

        const pointArray = points.map(p => {
          const arr = [p.x, p.y, p.z];
          if (p.intensity !== undefined) arr.push(p.intensity);
          return arr;
        });

        const result = await pointNetService.classifyPoints(pointArray, bounds);

        const classificationCount = {};
        for (const label of result.labels) {
          classificationCount[label] = (classificationCount[label] || 0) + 1;
        }

        const labeledPoints = points.map((p, i) => ({
          ...p,
          classification: result.labels[i],
        }));

        const compressed = await dracoCompressor.compressPointCloud(labeledPoints);

        const classifiedS3Key = `${pointCloudId}/classified/lod0/${chunk.octreeKey}.drc`;
        await s3Storage.upload(classifiedS3Key, compressed.buffer);

        await Chunk.findByIdAndUpdate(chunk._id, {
          hasClassification: true,
          classificationCount,
          classifiedS3Key,
          classificationStatus: 'classified',
        });

        processedChunks++;
        console.log(`Classified chunk ${processedChunks}/${totalChunks}`);

      } catch (error) {
        console.error(`Failed to classify chunk ${chunk.octreeKey}:`, error.message);
        await Chunk.findByIdAndUpdate(chunk._id, {
          classificationStatus: 'failed',
        });
      }
    }

    await PointCloud.findByIdAndUpdate(pointCloudId, {
      hasClassification: true,
    });

    return { processedChunks, totalChunks };
  }

  async getClassificationStatus(pointCloudId) {
    const chunks = await Chunk.find({ pointCloudId }).lean();

    if (chunks.length === 0) {
      return { status: 'no_chunks', classified: 0, total: 0 };
    }

    const classified = chunks.filter(c => c.classificationStatus === 'classified').length;
    const classifying = chunks.filter(c => c.classificationStatus === 'classifying').length;
    const failed = chunks.filter(c => c.classificationStatus === 'failed').length;

    let overallStatus = 'unclassified';
    if (classified === chunks.length) {
      overallStatus = 'classified';
    } else if (classifying > 0 || this.classificationJobs.has(pointCloudId)) {
      overallStatus = 'classifying';
    } else if (classified > 0) {
      overallStatus = 'partial';
    }

    return {
      status: overallStatus,
      classified,
      classifying,
      failed,
      total: chunks.length,
      isProcessing: this.classificationJobs.has(pointCloudId),
    };
  }

  async getClassificationSummary(pointCloudId) {
    const chunks = await Chunk.find({ pointCloudId, hasClassification: true }).lean();

    const totalCounts = {};
    for (const chunk of chunks) {
      if (chunk.classificationCount) {
        for (const [label, count] of Object.entries(chunk.classificationCount)) {
          totalCounts[label] = (totalCounts[label] || 0) + count;
        }
      }
    }

    const classInfo = pointNetService.getClasses();
    const summary = {};

    for (const cls of classInfo.classes) {
      const count = totalCounts[cls.id] || 0;
      summary[cls.id] = {
        name: cls.name,
        color: cls.color,
        count,
      };
    }

    return summary;
  }

  getClassInfo() {
    return pointNetService.getClasses();
  }
}

const classificationService = new ClassificationService();
module.exports = classificationService;
module.exports.ClassificationService = ClassificationService;
