const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: false,
    default: ''
  },
  folder: {
    type: String,
    default: '默认文件夹'
  },
  tags: [{
    type: String
  }],
  isSynced: {
    type: Boolean,
    default: false
  },
  cloudId: {
    type: String,
    default: null
  },
  version: {
    type: Number,
    default: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

noteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (this.isModified('title') || this.isModified('content') || this.isModified('tags')) {
    this.version = (this.version || 0) + 1;
  }
  next();
});

module.exports = mongoose.model('Note', noteSchema);
