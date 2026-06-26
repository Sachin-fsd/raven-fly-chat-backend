import { DataAPIClient, Db } from '@datastax/astra-db-ts';
import { env } from './env.config';
import { logger } from '../logger/logger';

let db: Db;

export const connectAstra = (): Db => {
  try {
    const client = new DataAPIClient(env.ASTRA_DB_APPLICATION_TOKEN);
    db = client.db(env.ASTRA_DB_API_ENDPOINT, { keyspace: env.ASTRA_DB_KEYSPACE });
    logger.info('✅ AstraDB (Data API) client initialized successfully');
    return db;
  } catch (error) {
    logger.error('❌ Failed to initialize AstraDB client', { error: (error as Error).message });
    process.exit(1);
  }
};

export const getAstraDb = (): Db => {
  if (!db) {
    throw new Error('AstraDB has not been initialized. Call connectAstra() first.');
  }
  return db;
};

// Collection name constants for consistent access across the codebase
export const ASTRA_COLLECTIONS = {
  MESSAGES: 'messages',
  CONVERSATIONS: 'conversations',
  USER_INBOX: 'user_inbox',
} as const;
