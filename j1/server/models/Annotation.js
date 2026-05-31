const mongoose = require('mongoose');

const annotationSchema = new mongoose.Schema({
  scoreId: { type: String, required: true, default: 'default' },
  noteIndex: { type: Number, required: true },
  color: { type: String, required: true },
  author: { type: String, default: 'anonymous' },
  comment: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  version: { type: Number, default: 0 },
  sequence: { type: Number, default: 0, index: true }
});

annotationSchema.index({ scoreId: 1, noteIndex: 1 });
annotationSchema.index({ scoreId: 1, sequence: 1 });
annotationSchema.index({ scoreId: 1, createdAt: 1 });

annotationSchema.pre('save', function(next) {
  if (this.isNew) {
    this.version = 1;
  } else {
    this.increment();
  }
  next();
});

module.exports = mongoose.model('Annotation', annotationSchema);
