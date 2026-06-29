import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler.util';
import { ApiSuccessResponse } from '../../utils/api-response.util';
import { HTTP_STATUS } from '../../constants/app.constants';
import { sendMessage, getMessageHistory } from './messages.service';
import { SendMessageDto } from './dto/send-messages.dto';
import { GetMessagesDto } from './dto/get-messages.dto';
import { BadRequestError } from '../../utils/errors.util';
import { logger } from '../../logger/logger';

export const postMessage = asyncHandler(async (req: Request, res: Response) => {
  const { text, conversationId: bodyConversationId } = req.body as SendMessageDto;
  const conversationId = req.params.conversationId ?? bodyConversationId;

  if (!conversationId) {
    throw new BadRequestError('conversationId is required');
  }

  logger.info('messages.controller.postMessage: entry', { conversationId, senderId: req.user?.userId });

  const result = await sendMessage(conversationId, req.user!.userId, text);

  logger.info('messages.controller.postMessage: exit', { conversationId, messageId: result.messageId });
  ApiSuccessResponse(res, HTTP_STATUS.CREATED, 'Message sent successfully', result);
});

export const getMessages = asyncHandler(async (req: Request, res: Response) => {
  const conversationId = req.params.conversationId;
  logger.info('messages.controller.getMessages: entry', { conversationId });

  const messages = await getMessageHistory(conversationId, req.user!.userId, req.query as unknown as GetMessagesDto);
  console.log({messages:messages.map(m=>[m.text, m.status])});
  ApiSuccessResponse(res, HTTP_STATUS.OK, 'Message history fetched successfully', messages);
});
