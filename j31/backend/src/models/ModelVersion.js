import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ModelVersion = sequelize.define('ModelVersion', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  version: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  modelType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'rule_based'
  },
  modelData: {
    type: DataTypes.JSONB
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  trainingSampleCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  validationAccuracy: {
    type: DataTypes.FLOAT
  },
  testAccuracy: {
    type: DataTypes.FLOAT
  },
  avgOffsetError: {
    type: DataTypes.FLOAT
  },
  trainedAt: {
    type: DataTypes.DATE
  }
}, {
  timestamps: true,
  tableName: 'model_versions',
  indexes: [
    { fields: ['isActive'] },
    { fields: ['isDefault'] }
  ]
});

ModelVersion.getDefaultModel = async function() {
  return this.findOne({ where: { isDefault: true, isActive: true } });
};

ModelVersion.getActiveModels = async function() {
  return this.findAll({ where: { isActive: true } });
};

export default ModelVersion;
