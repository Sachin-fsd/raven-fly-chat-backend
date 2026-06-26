import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000').transform(Number),

  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),

  ASTRA_DB_API_ENDPOINT: z.string().min(1, 'ASTRA_DB_API_ENDPOINT is required'),
  ASTRA_DB_APPLICATION_TOKEN: z.string().min(1, 'ASTRA_DB_APPLICATION_TOKEN is required'),
  ASTRA_DB_KEYSPACE: z.string().default('default_keyspace'),

  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  // Upstash (and most managed Redis providers) require TLS. ioredis only
  // auto-enables TLS for `rediss://` URLs, so we expose an explicit flag
  // in case the URL scheme is plain `redis://` (as Upstash's own
  // `redis-cli --tls -u redis://...` example implies).
  REDIS_TLS: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),

  RABBITMQ_URL: z.string().min(1, 'RABBITMQ_URL is required'),
  RABBITMQ_CHAT_QUEUE: z.string().default('chat_messages_queue'),

  CENTRIFUGO_API_URL: z.string().min(1, 'CENTRIFUGO_API_URL is required'),
  CENTRIFUGO_API_KEY: z.string().min(1, 'CENTRIFUGO_API_KEY is required'),
  // Must match `token_hmac_secret_key` in Centrifugo's own config — used to
  // sign the connection JWT we hand the frontend.
  CENTRIFUGO_TOKEN_SECRET: z.string().min(1, 'CENTRIFUGO_TOKEN_SECRET is required'),

  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  CORS_ORIGIN: z.string().default('*'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
