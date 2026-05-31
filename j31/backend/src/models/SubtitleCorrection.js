import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const SubtitleCorrection = sequelize.define('SubtitleCorrection', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  taskId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'tasks',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  subtitleIndex: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  originalStart: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  originalEnd: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  correctedStart: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  correctedEnd: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  originalText: {
    type: DataTypes.TEXT
  },
  vadStart: {
    type: DataTypes.FLOAT
  },
  vadEnd: {
    type: DataTypes.FLOAT
  },
  userId: {
    type: DataTypes.STRING(100)
  },
  isUsedForTraining: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  trainingBatchId: {
    type: DataTypes.UUID
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  timestamps: true,
  tableName: 'subtitle_corrections',
  indexes: [
    { fields: ['taskId'] },
    { fields: ['isUsedForTraining'] },
    { fields: ['createdAt'] }
  ]
});

export default SubtitleCorrection;
