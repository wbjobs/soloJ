import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Room = sequelize.define('Room', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  hostId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  videoId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

export default Room;
