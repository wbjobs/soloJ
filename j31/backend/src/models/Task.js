import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'uploading', 'processing', 'completed', 'failed'),
    defaultValue: 'pending',
    allowNull: false
  },
  videoFileName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  videoFileSize: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  videoDuration: {
    type: DataTypes.FLOAT
  },
  subtitleFileName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  originalSubtitlePath: {
    type: DataTypes.STRING,
    allowNull: false
  },
  alignedSubtitlePath: {
    type: DataTypes.STRING
  },
  alignmentOffset: {
    type: DataTypes.FLOAT
  },
  confidence: {
    type: DataTypes.FLOAT
  },
  vadSegments: {
    type: DataTypes.JSONB
  },
  subtitleSegments: {
    type: DataTypes.JSONB
  },
  errorMessage: {
    type: DataTypes.TEXT
  },
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  modelVersion: {
    type: DataTypes.STRING(50)
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  timestamps: true,
  tableName: 'tasks',
  indexes: [
    { fields: ['status'] },
    { fields: ['createdAt'] },
    { fields: ['modelVersion'] }
  ]
});

export default Task;
