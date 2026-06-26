import { Router } from 'express';
import { postMessage, getMessages } from './messages.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { sendMessageDto } from './dto/send-messages.dto';
import { getMessagesDto } from './dto/get-messages.dto';

// mergeParams: true lets this router read `:conversationId` when mounted
// nested under /api/v1/conversations/:conversationId/messages, while still
// working standalone at /api/v1/messages (conversationId supplied in body).
const router = Router({ mergeParams: true });

router.use(authenticate);

router.post('/', validate(sendMessageDto), postMessage);
router.get('/', validate(getMessagesDto, 'query'), getMessages);

export default router;
