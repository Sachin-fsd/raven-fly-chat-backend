import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import { UnauthorizedError } from '../utils/errors.util';
import { logger } from '../logger/logger';

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }

    const token = header.split(' ')[1];
    const payload = verifyAccessToken(token);
    req.user = payload;

    next();
  } catch (error) {
    logger.warn('Authentication failed', { error: (error as Error).message });
    next(new UnauthorizedError('Invalid or expired access token'));
  }
};
