const mongoose = require('mongoose');

const annotationSchema = new mongoose.Schema({
  pointCloudId: { type: mongoose.Schema.Types.ObjectId, ref: 'PointCloud', required: true, index: true },
  name: { type: String, required: true },
  description: String,
  category: { type: String, required: true },
  points: [{
    x: Number,
    y: Number,
    z: Number,
    intensity: Number,
    rgb: { r: Number, g: Number, b: Number },
  }],
  pointCount: { type: Number, default: 0 },
  boundingBox: {
    minX: Number, minY: Number, minZ: Number,
    maxX: Number, maxY: Number, maxZ: Number,
  },
  color: String,
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

annotationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (this.points && !this.pointCount) {
    this.pointCount = this.points.length;
  }
  if (this.points && this.points.length > 0 && !this.boundingBox) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const p of this.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      minZ = Math.min(minZ, p.z);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      maxZ = Math.max(maxZ, p.z);
    }

    this.boundingBox = { minX, minY, minZ, maxX, maxY, maxZ };
  }
  next();
});

annotationSchema.index({ pointCloudId: 1, category: 1 });

module.exports = mongoose.model('Annotation', annotationSchema);
