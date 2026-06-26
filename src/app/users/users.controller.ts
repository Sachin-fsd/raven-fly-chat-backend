import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.util';
import { ApiSuccessResponse } from '../../utils/api-response.util';
import { HTTP_STATUS } from '../../constants/app.constants';
import { getUserById, searchUsers } from './users.service';
import { logger } from '../../logger/logger';

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  logger.info('users.controller.getMe: entry', { userId: req.user?.userId });
  const user = await getUserById(req.user!.userId);
  ApiSuccessResponse(res, HTTP_STATUS.OK, 'Current user fetched successfully', user);
});

export const getUserProfile = asyncHandler(async (req: Request, res: Response) => {
  logger.info('users.controller.getUserProfile: entry', { targetUserId: req.params.userId });
  const user = await getUserById(req.params.userId);
  ApiSuccessResponse(res, HTTP_STATUS.OK, 'User profile fetched successfully', user);
});

export const searchUsersHandler = asyncHandler(async (req: Request, res: Response) => {
  logger.info('users.controller.searchUsersHandler: entry', { query: req.query.q });
  const { q } = req.query as { q: string };
  const users = await searchUsers(q, req.user!.userId);
  ApiSuccessResponse(res, HTTP_STATUS.OK, 'Users fetched successfully', users);
});
