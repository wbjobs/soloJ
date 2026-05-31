const mongoose = require('mongoose');

const pointCloudSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  totalPoints: { type: Number, required: true },
  bounds: {
    minX: Number, minY: Number, minZ: Number,
    maxX: Number, maxY: Number, maxZ: Number,
  },
  attributes: {
    hasRGB: { type: Boolean, default: false },
    hasIntensity: { type: Boolean, default: false },
    hasClassification: { type: Boolean, default: false },
  },
  maxLODLevel: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['uploading', 'processing', 'ready', 'failed'],
    default: 'uploading',
  },
  errorMessage: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

pointCloudSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('PointCloud', pointCloudSchema);
