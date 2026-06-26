import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../config/redis.config';

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  store: new RedisStore({
    // @ts-expect-error - ioredis call signature is compatible at runtime
    sendCommand: (...args: string[]) => redisClient.call(...args),
    prefix: 'rl:global:',
  }),
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts, please try again later.' },
  store: new RedisStore({
    // @ts-expect-error - ioredis call signature is compatible at runtime
    sendCommand: (...args: string[]) => redisClient.call(...args),
    prefix: 'rl:auth:',
  }),
});
