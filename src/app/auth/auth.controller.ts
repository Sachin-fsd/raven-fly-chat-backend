import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.util';
import { ApiSuccessResponse } from '../../utils/api-response.util';
import { HTTP_STATUS, COOKIE_NAMES } from '../../constants/app.constants';
import { registerUser, loginUser, refreshUserTokens } from './auth.service';
import { RegisterDto } from './dto/register-auth.dto';
import { LoginDto } from './dto/login-auth.dto';
import { UnauthorizedError } from '../../utils/errors.util';
import { logger } from '../../logger/logger';
import { env } from '../../config/env.config';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'none' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  logger.info('auth.controller.register: entry');
  const dto = req.body as RegisterDto;

  const { user, accessToken, refreshToken, centrifugoToken } = await registerUser(dto);

  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, REFRESH_COOKIE_OPTIONS);
  logger.info('auth.controller.register: exit', { userId: user.id });

  ApiSuccessResponse(res, HTTP_STATUS.CREATED, 'User registered successfully', {
    user,
    accessToken,
    centrifugoToken,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  logger.info('auth.controller.login: entry');
  const dto = req.body as LoginDto;

  const { user, accessToken, refreshToken, centrifugoToken } = await loginUser(dto);

  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, REFRESH_COOKIE_OPTIONS);
  logger.info('auth.controller.login: exit', { userId: user.id });

  ApiSuccessResponse(res, HTTP_STATUS.OK, 'Login successful', {
    user,
    accessToken,
    centrifugoToken,
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  logger.info('auth.controller.refresh: entry');

  const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] ?? req.body?.refreshToken;
  if (!refreshToken) {
    throw new UnauthorizedError('Refresh token not provided');
  }

  const { accessToken, refreshToken: newRefreshToken, centrifugoToken } = await refreshUserTokens(refreshToken);

  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, newRefreshToken, REFRESH_COOKIE_OPTIONS);
  logger.info('auth.controller.refresh: exit');

  ApiSuccessResponse(res, HTTP_STATUS.OK, 'Token refreshed successfully', {
    accessToken,
    centrifugoToken,
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  logger.info('auth.controller.logout: entry');
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN);
  ApiSuccessResponse(res, HTTP_STATUS.OK, 'Logged out successfully', null);
});
