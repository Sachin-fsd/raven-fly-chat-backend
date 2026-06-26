import { Router } from 'express';
import { createConversation, getConversation, getInbox, markAsRead } from './conversations.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createConversationDto } from './dto/create-conversations.dto';
import { markAsReadDto } from './dto/mark-as-read-conversations.dto';
import messagesRouter from '../messages/messages.routes';

const router = Router();

router.use(authenticate);

router.post('/', validate(createConversationDto), createConversation);
router.get('/inbox', getInbox);
router.get('/:conversationId', getConversation);
router.patch('/:conversationId/read', validate(markAsReadDto), markAsRead);

// Nested message routes: /api/v1/conversations/:conversationId/messages
router.use('/:conversationId/messages', messagesRouter);

export default router;
