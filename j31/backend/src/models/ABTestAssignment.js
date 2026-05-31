import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ABTestAssignment = sequelize.define('ABTestAssignment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  abTestId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'ab_tests',
      key: 'id'
    },
    onDelete: 'CASCADE'
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
  assignedModelId: {
    type: DataTypes.UUID,
    references: {
      model: 'model_versions',
      key: 'id'
    }
  },
  variant: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  offsetError: {
    type: DataTypes.FLOAT
  },
  isConverted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true,
  tableName: 'ab_test_assignments',
  indexes: [
    { fields: ['abTestId'] },
    { fields: ['taskId'] }
  ]
});

export default ABTestAssignment;
