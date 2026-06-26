import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.util';
import { ApiErrorResponse } from '../utils/api-response.util';
import { logger } from '../logger/logger';
import { HTTP_STATUS } from '../constants/app.constants';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, HTTP_STATUS.NOT_FOUND));
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof AppError) {
    logger.error(`[${req.method} ${req.originalUrl}] ${err.message}`, {
      statusCode: err.statusCode,
      errors: err.errors,
    });
    ApiErrorResponse(res, err.statusCode, err.message, err.errors);
    return;
  }

  logger.error(`[${req.method} ${req.originalUrl}] Unhandled error: ${err.message}`, { stack: err.stack });
  ApiErrorResponse(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Something went wrong. Please try again later.');
};
