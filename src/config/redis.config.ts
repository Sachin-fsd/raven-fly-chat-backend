import Redis from 'ioredis';
import { env } from './env.config';
import { logger } from '../logger/logger';

const buildRedisOptions = () => {
  const url = new URL(env.REDIS_URL);
  const isTlsScheme = url.protocol === 'rediss:';

  return {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => Math.min(times * 100, 3000),
    // Upstash (and most managed Redis providers) require TLS. ioredis only
    // auto-enables TLS when the URL uses `rediss://`, so if REDIS_TLS=true
    // but the URL is plain `redis://`, we force it on here.
    ...(env.REDIS_TLS && !isTlsScheme ? { tls: { servername: url.hostname } } : {}),
  };
};

export const redisClient = new Redis(env.REDIS_URL, buildRedisOptions());

redisClient.on('connect', () => logger.info('✅ Redis connected successfully'));
redisClient.on('error', (err) => logger.error('❌ Redis connection error', { error: err.message }));

export default redisClient;
