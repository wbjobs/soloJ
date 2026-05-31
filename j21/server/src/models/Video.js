import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Video = sequelize.define('Video', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  size: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  duration: {
    type: DataTypes.FLOAT,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

export default Video;
