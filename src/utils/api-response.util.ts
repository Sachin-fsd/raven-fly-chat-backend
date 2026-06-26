import { Response } from 'express';

interface SuccessResponseBody<T> {
  success: true;
  message: string;
  data: T;
}

interface ErrorResponseBody {
  success: false;
  message: string;
  errors?: unknown[];
}

export const ApiSuccessResponse = <T>(
  res: Response,
  statusCode: number,
  message: string,
  data: T,
): Response<SuccessResponseBody<T>> => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const ApiErrorResponse = (
  res: Response,
  statusCode: number,
  message: string,
  errors?: unknown[],
): Response<ErrorResponseBody> => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  });
};
