import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const TrainingBatch = sequelize.define('TrainingBatch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100)
  },
  sampleCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  modelVersionId: {
    type: DataTypes.UUID,
    references: {
      model: 'model_versions',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'running', 'completed', 'failed'),
    defaultValue: 'pending',
    allowNull: false
  },
  startedAt: {
    type: DataTypes.DATE
  },
  completedAt: {
    type: DataTypes.DATE
  },
  parameters: {
    type: DataTypes.JSONB
  },
  metrics: {
    type: DataTypes.JSONB
  }
}, {
  timestamps: true,
  tableName: 'training_batches',
  indexes: [
    { fields: ['status'] },
    { fields: ['modelVersionId'] }
  ]
});

export default TrainingBatch;
