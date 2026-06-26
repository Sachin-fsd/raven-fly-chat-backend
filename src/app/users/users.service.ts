import { UserModel } from './users.schema';
import { NotFoundError } from '../../utils/errors.util';
import { logger } from '../../logger/logger';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

const toPublicUser = (user: { _id: unknown; name: string; email: string }): PublicUser => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
});

export const getUserById = async (userId: string): Promise<PublicUser> => {
  logger.info('users.service.getUserById: entry', { userId });

  const user = await UserModel.findById(userId).lean();
  if (!user) {
    logger.warn('users.service.getUserById: user not found', { userId });
    throw new NotFoundError('User not found');
  }

  logger.info('users.service.getUserById: exit', { userId });
  return toPublicUser(user);
};

/**
 * Searches users by name or email, for the "find people to chat with" flow.
 * Backed by a case-insensitive prefix/contains match. At scale this should
 * be backed by a search index (e.g. Atlas Search), but a regex query is fine
 * for moderate user counts.
 */
export const searchUsers = async (query: string, excludeUserId: string): Promise<PublicUser[]> => {
  logger.info('users.service.searchUsers: entry', { query });

  const regex = new RegExp(query.trim(), 'i');
  const users = await UserModel.find({
    _id: { $ne: excludeUserId },
    $or: [{ name: regex }, { email: regex }],
  })
    .limit(20)
    .lean();

  logger.info('users.service.searchUsers: exit', { count: users.length });
  return users.map(toPublicUser);
};
