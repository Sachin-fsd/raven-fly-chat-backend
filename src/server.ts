import { createApp } from './app';
import { env } from './config/env.config';
import { logger } from './logger/logger';
import { connectMongo, disconnectMongo } from './config/mongodb.config';
import { connectAstra } from './config/astra.config';
import { redisClient } from './config/redis.config';
import { connectRabbitMQ, closeRabbitMQ } from './config/rabbitmq.config';
import { startChatWorker } from './workers/chat.worker';

const bootstrap = async (): Promise<void> => {
  logger.info('🚀 Bootstrapping chat backend...');

  // Databases & infra — order matters: RabbitMQ must connect before the
  // worker starts consuming, and Astra/Mongo must be ready before any
  // request handlers touch them.
  await connectMongo();
  connectAstra();
  await connectRabbitMQ();

  // Redis connects lazily via ioredis, but we wait for the first ping so
  // startup fails fast if Redis is unreachable.
  await redisClient.ping();
  logger.info('✅ Redis ping successful');

  await startChatWorker();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`✅ Server listening on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    server.close(async () => {
      await closeRabbitMQ();
      await disconnectMongo();
      redisClient.disconnect();
      logger.info('👋 Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

bootstrap().catch((error) => {
  logger.error('❌ Fatal error during bootstrap', { error: (error as Error).message, stack: (error as Error).stack });
  process.exit(1);
});
