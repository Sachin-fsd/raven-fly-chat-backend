import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.config';
import { logger } from './logger/logger';
import { globalRateLimiter } from './middlewares/rate-limiter.middleware';
import { notFoundHandler, errorHandler } from './middlewares/error.middleware';
import { ApiSuccessResponse } from './utils/api-response.util';
import { getAstraDb, ASTRA_COLLECTIONS } from './config/astra.config';

import authRoutes from './app/auth/auth.routes';
import usersRoutes from './app/users/users.routes';
import conversationsRoutes from './app/conversations/conversations.routes';
import messagesRoutes from './app/messages/messages.routes';

const morganStream = {
  write: (message: string) => logger.info(message.trim()),
};

export const createApp = (): Application => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(morgan('dev', { stream: morganStream }));
  app.use(globalRateLimiter);

  app.get('/health', (_req: Request, res: Response) => {
    ApiSuccessResponse(res, 200, 'Service is healthy', {
      status: 'up',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    });
  });

  app.get('/keepalive', async (_req: Request, res: Response) => {
    const results: { backend: string; centrifugo: string; astra: string; timestamp: string } = {
      backend: 'up',
      centrifugo: 'unknown',
      astra: 'unknown',
      timestamp: new Date().toISOString(),
    };

    // Check Centrifugo health
    try {
      const centrifugoHealthUrl = env.CENTRIFUGO_API_URL.replace('/api', '/health');
      const response = await fetch(centrifugoHealthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      results.centrifugo = response.ok ? 'up' : 'down';
    } catch (error) {
      results.centrifugo = 'error';
      logger.warn('Centrifugo health check failed', { error: (error as Error).message });
    }

    // Check AstraDB health with lightweight query (findOne with limit 1)
    try {
      const db = getAstraDb();
      const collection = db.collection(ASTRA_COLLECTIONS.MESSAGES);
      // This is O(1) - just checks connection and fetches at most 1 document
      await collection.findOne({});
      results.astra = 'up';
    } catch (error) {
      results.astra = 'error';
      logger.warn('AstraDB health check failed', { error: (error as Error).message });
    }

    ApiSuccessResponse(res, 200, 'Keepalive check completed', results);
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/conversations', conversationsRoutes);
  // Standalone messages endpoint, matching the original spec's /api/messages
  // contract — conversationId is supplied in the request body here, whereas
  // the nested route under /conversations/:conversationId/messages takes it
  // from the URL param. Both paths share the same router (mergeParams).
  app.use('/api/v1/messages', messagesRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
