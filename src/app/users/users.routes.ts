import { Router } from 'express';
import { getMe, getUserProfile, searchUsersHandler } from './users.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { searchUsersDto } from './dto/search-users.dto';

const router = Router();

router.use(authenticate);

router.get('/me', getMe);
router.get('/search', validate(searchUsersDto, 'query'), searchUsersHandler);
router.get('/:userId', getUserProfile);

export default router;
