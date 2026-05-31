const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema({
  pointCloudId: { type: mongoose.Schema.Types.ObjectId, ref: 'PointCloud', required: true, index: true },
  lodLevel: { type: Number, required: true, index: true },
  octreeKey: { type: String, required: true, index: true },
  bounds: {
    minX: Number, minY: Number, minZ: Number,
    maxX: Number, maxY: Number, maxZ: Number,
  },
  pointCount: { type: Number, required: true },
  s3Key: { type: String, required: true },
  compressedSize: { type: Number, required: true },
  originalSize: { type: Number, required: true },
  hasRGB: { type: Boolean, default: false },
  hasIntensity: { type: Boolean, default: false },
  hasClassification: { type: Boolean, default: false },
  classificationCount: { type: Map, of: Number, default: {} },
  classifiedS3Key: String,
  classificationStatus: {
    type: String,
    enum: ['unclassified', 'classifying', 'classified', 'failed'],
    default: 'unclassified',
  },
  createdAt: { type: Date, default: Date.now },
});

chunkSchema.index({ pointCloudId: 1, lodLevel: 1, octreeKey: 1 }, { unique: true });
chunkSchema.index({ pointCloudId: 1, lodLevel: 1 });

module.exports = mongoose.model('Chunk', chunkSchema);
