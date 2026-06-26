import amqp, { Channel, ChannelModel } from 'amqplib';
import { env } from './env.config';
import { logger } from '../logger/logger';

let connection: ChannelModel;
let channel: Channel;

export const connectRabbitMQ = async (): Promise<Channel> => {
  try {
    connection = await amqp.connect(env.RABBITMQ_URL);
    channel = await connection.createChannel();

    await channel.assertQueue(env.RABBITMQ_CHAT_QUEUE, { durable: true });

    logger.info('✅ RabbitMQ connected and channel created successfully', {
      queue: env.RABBITMQ_CHAT_QUEUE,
    });

    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error', { error: err.message });
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
    });

    return channel;
  } catch (error) {
    logger.error('❌ Failed to connect to RabbitMQ', { error: (error as Error).message });
    process.exit(1);
  }
};

export const getRabbitChannel = (): Channel => {
  if (!channel) {
    throw new Error('RabbitMQ channel has not been initialized. Call connectRabbitMQ() first.');
  }
  return channel;
};

export const closeRabbitMQ = async (): Promise<void> => {
  await channel?.close();
  await connection?.close();
  logger.info('RabbitMQ connection closed gracefully');
};
