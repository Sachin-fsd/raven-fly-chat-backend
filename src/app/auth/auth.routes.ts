import { Router } from 'express';
import { register, login, refresh, logout } from './auth.controller';
import { validate } from '../../middlewares/validate.middleware';
import { registerDto } from './dto/register-auth.dto';
import { loginDto } from './dto/login-auth.dto';
import { refreshTokenDto } from './dto/refresh-auth.dto';
import { authRateLimiter } from '../../middlewares/rate-limiter.middleware';

const router = Router();

router.post('/register', authRateLimiter, validate(registerDto), register);
router.post('/login', authRateLimiter, validate(loginDto), login);
router.post('/refresh', validate(refreshTokenDto), refresh);
router.post('/logout', logout);

export default router;
