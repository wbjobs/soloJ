import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ABTest = sequelize.define('ABTest', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  modelAId: {
    type: DataTypes.UUID,
    references: {
      model: 'model_versions',
      key: 'id'
    }
  },
  modelBId: {
    type: DataTypes.UUID,
    references: {
      model: 'model_versions',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'running', 'completed', 'stopped'),
    defaultValue: 'pending',
    allowNull: false
  },
  startTime: {
    type: DataTypes.DATE
  },
  endTime: {
    type: DataTypes.DATE
  },
  trafficSplitA: {
    type: DataTypes.INTEGER,
    defaultValue: 50
  },
  trafficSplitB: {
    type: DataTypes.INTEGER,
    defaultValue: 50
  },
  results: {
    type: DataTypes.JSONB
  },
  winnerId: {
    type: DataTypes.UUID,
    references: {
      model: 'model_versions',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  tableName: 'ab_tests',
  indexes: [
    { fields: ['status'] },
    { fields: ['createdAt'] }
  ]
});

ABTest.getRunningTests = async function() {
  return this.findAll({ where: { status: 'running' } });
};

export default ABTest;
