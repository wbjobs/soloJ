import mongoose from 'mongoose';
import { config } from '../config';

export async function connectDatabase(): Promise<mongoose.Connection> {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB successfully');
    return mongoose.connection;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}
