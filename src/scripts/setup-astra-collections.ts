/**
 * Run this once per AstraDB keyspace before using the app:
 *   npm run setup:astra
 *
 * AstraDB's Data API does NOT auto-create collections the way Mongoose
 * auto-creates a Mongo collection on first write — `db.collection('x')`
 * just gives you a handle to query against; if `x` doesn't exist yet,
 * every operation on it throws (exactly the error you're hitting).
 */
import { DataAPIClient } from '@datastax/astra-db-ts';
import { env } from '../config/env.config';
import { ASTRA_COLLECTIONS } from '../config/astra.config';
import { logger } from '../logger/logger';

const REQUIRED_COLLECTIONS = Object.values(ASTRA_COLLECTIONS);

const run = async (): Promise<void> => {
  const client = new DataAPIClient(env.ASTRA_DB_APPLICATION_TOKEN);
  const db = client.db(env.ASTRA_DB_API_ENDPOINT, { keyspace: env.ASTRA_DB_KEYSPACE });

  const existing = await db.listCollections();
  const existingNames = new Set(existing.map((c) => c.name));

  for (const name of REQUIRED_COLLECTIONS) {
    if (existingNames.has(name)) {
      logger.info(`✅ Collection already exists, skipping: ${name}`);
      continue;
    }

    logger.info(`Creating collection: ${name}...`);
    await db.createCollection(name);
    logger.info(`✅ Created collection: ${name}`);
  }

  logger.info('🎉 AstraDB setup complete. You can now start the server normally.');
};

run().catch((error) => {
  logger.error('❌ AstraDB setup failed', { error: (error as Error).message });
  process.exit(1);
});
