import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AnnotationReply = sequelize.define('AnnotationReply', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  annotationId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  userName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

export default AnnotationReply;
