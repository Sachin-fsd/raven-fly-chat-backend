import mongoose from 'mongoose';
import { env } from './env.config';
import { logger } from '../logger/logger';

export const connectMongo = async (): Promise<void> => {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.MONGO_URI);
    logger.info('✅ MongoDB (Mongoose) connected successfully');

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
  } catch (error) {
    logger.error('❌ Failed to connect to MongoDB', { error: (error as Error).message });
    process.exit(1);
  }
};

export const disconnectMongo = async (): Promise<void> => {
  await mongoose.disconnect();
  logger.info('MongoDB connection closed');
};
