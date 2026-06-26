import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.util';
import { ApiSuccessResponse } from '../../utils/api-response.util';
import { HTTP_STATUS } from '../../constants/app.constants';
import { createOrGetConversation, getConversationById, getUserInbox, markConversationAsRead } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversations.dto';
import { MarkAsReadDto } from './dto/mark-as-read-conversations.dto';
import { logger } from '../../logger/logger';

export const createConversation = asyncHandler(async (req: Request, res: Response) => {
  logger.info('conversations.controller.createConversation: entry', { userId: req.user?.userId });
  const dto = req.body as CreateConversationDto;

  const conversation = await createOrGetConversation(req.user!.userId, dto);

  logger.info('conversations.controller.createConversation: exit', { conversationId: conversation._id });
  ApiSuccessResponse(res, HTTP_STATUS.CREATED, 'Conversation created successfully', conversation);
});

export const getConversation = asyncHandler(async (req: Request, res: Response) => {
  logger.info('conversations.controller.getConversation: entry', { conversationId: req.params.conversationId });
  const conversation = await getConversationById(req.params.conversationId, req.user!.userId);
  ApiSuccessResponse(res, HTTP_STATUS.OK, 'Conversation fetched successfully', conversation);
});

export const getInbox = asyncHandler(async (req: Request, res: Response) => {
  logger.info('conversations.controller.getInbox: entry', { userId: req.user?.userId });
  const inbox = await getUserInbox(req.user!.userId);
  ApiSuccessResponse(res, HTTP_STATUS.OK, 'Inbox fetched successfully', inbox);
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  logger.info('conversations.controller.markAsRead: entry', { conversationId: req.params.conversationId });
  const { lastReadMessageId } = req.body as MarkAsReadDto;

  await markConversationAsRead(req.params.conversationId, req.user!.userId, lastReadMessageId);

  ApiSuccessResponse(res, HTTP_STATUS.OK, 'Conversation marked as read', null);
});
