import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { BadRequestError } from '../utils/errors.util';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Generic Zod validation middleware factory.
 * Validates req[target] against the provided schema and replaces it
 * with the parsed (and type-coerced) value on success.
 */
export const validate = (schema: ZodSchema, target: ValidationTarget = 'body') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const formattedErrors = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new BadRequestError('Validation failed', formattedErrors));
    }

    req[target] = result.data;
    next();
  };
};
