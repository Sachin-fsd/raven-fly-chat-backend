import bcrypt from 'bcryptjs';
import { UserModel } from '../users/users.schema';
import { RegisterDto } from './dto/register-auth.dto';
import { LoginDto } from './dto/login-auth.dto';
import { ConflictError, UnauthorizedError } from '../../utils/errors.util';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.util';
import { generateCentrifugoConnectionToken } from '../../config/centrifugo.config';
import { logger } from '../../logger/logger';

const SALT_ROUNDS = 12;

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  centrifugoToken: string;
}

interface SafeUser {
  id: string;
  email: string;
  name: string;
}

const toSafeUser = (user: { _id: unknown; email: string; name: string }): SafeUser => ({
  id: String(user._id),
  email: user.email,
  name: user.name,
});

export const registerUser = async (dto: RegisterDto): Promise<{ user: SafeUser } & AuthTokens> => {
  logger.info('auth.service.registerUser: entry', { email: dto.email });

  const existingUser = await UserModel.findOne({ email: dto.email }).lean();
  if (existingUser) {
    logger.warn('auth.service.registerUser: email already in use', { email: dto.email });
    throw new ConflictError('An account with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

  const createdUser = await UserModel.create({
    name: dto.name,
    email: dto.email,
    password: hashedPassword,
  });

  const safeUser = toSafeUser(createdUser);
  const tokens = issueTokens(safeUser);

  logger.info('auth.service.registerUser: exit', { userId: safeUser.id });
  return { user: safeUser, ...tokens };
};

export const loginUser = async (dto: LoginDto): Promise<{ user: SafeUser } & AuthTokens> => {
  logger.info('auth.service.loginUser: entry', { email: dto.email });

  const user = await UserModel.findOne({ email: dto.email }).select('+password');
  if (!user) {
    logger.warn('auth.service.loginUser: user not found', { email: dto.email });
    throw new UnauthorizedError('Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(dto.password, user.password);
  if (!isPasswordValid) {
    logger.warn('auth.service.loginUser: invalid password', { email: dto.email });
    throw new UnauthorizedError('Invalid email or password');
  }

  const safeUser = toSafeUser(user);
  const tokens = issueTokens(safeUser);

  logger.info('auth.service.loginUser: exit', { userId: safeUser.id });
  return { user: safeUser, ...tokens };
};

export const refreshUserTokens = async (refreshToken: string): Promise<AuthTokens> => {
  logger.info('auth.service.refreshUserTokens: entry');

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    logger.warn('auth.service.refreshUserTokens: invalid refresh token', { error: (error as Error).message });
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const user = await UserModel.findById(payload.userId).lean();
  if (!user) {
    throw new UnauthorizedError('User no longer exists');
  }

  const tokens = issueTokens(toSafeUser(user));
  logger.info('auth.service.refreshUserTokens: exit', { userId: payload.userId });
  return tokens;
};

const issueTokens = (user: SafeUser): AuthTokens => {
  const jwtPayload = { userId: user.id, email: user.email };
  return {
    accessToken: signAccessToken(jwtPayload),
    refreshToken: signRefreshToken(jwtPayload),
    centrifugoToken: generateCentrifugoConnectionToken(user.id),
  };
};
