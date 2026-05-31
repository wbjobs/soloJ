import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CalibrationReport = sequelize.define('CalibrationReport', {
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
  modelVersion: {
    type: DataTypes.STRING(50)
  },
  originalOffset: {
    type: DataTypes.FLOAT
  },
  correctedOffset: {
    type: DataTypes.FLOAT
  },
  confidence: {
    type: DataTypes.FLOAT
  },
  vadSegmentCount: {
    type: DataTypes.INTEGER
  },
  subtitleSegmentCount: {
    type: DataTypes.INTEGER
  },
  matchRateBefore: {
    type: DataTypes.FLOAT
  },
  matchRateAfter: {
    type: DataTypes.FLOAT
  },
  avgOffsetErrorBefore: {
    type: DataTypes.FLOAT
  },
  avgOffsetErrorAfter: {
    type: DataTypes.FLOAT
  },
  reportData: {
    type: DataTypes.JSONB
  },
  filePath: {
    type: DataTypes.STRING(500)
  },
  userId: {
    type: DataTypes.STRING(100)
  }
}, {
  timestamps: true,
  tableName: 'calibration_reports',
  indexes: [
    { fields: ['taskId'] },
    { fields: ['createdAt'] }
  ]
});

export default CalibrationReport;
