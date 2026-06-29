import { getConversationsCollection, getUserInboxCollection } from './conversations.schema';
import { UserModel } from '../users/users.schema';
import { CreateConversationDto } from './dto/create-conversations.dto';
import { buildDirectConversationId } from '../../utils/bucket.util';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors.util';
import { ConversationDoc, ParticipantInfo, InboxConversationEntry } from '../../types/chat.types';
import { logger } from '../../logger/logger';
import { publishToCentrifugo } from '../../config/centrifugo.config';
import { buildConversationChannel } from '../../utils/channel.util';

export const createOrGetConversation = async (
  currentUserId: string,
  dto: CreateConversationDto,
): Promise<ConversationDoc> => {
  logger.info('conversations.service.createOrGetConversation: entry', { currentUserId, otherUserId: dto.participantId });

  if (dto.participantId === currentUserId) {
    throw new BadRequestError('Cannot start a conversation with yourself');
  }

  const allParticipantIds = [currentUserId, dto.participantId];

  const usersFromMongo = await UserModel.find({ _id: { $in: allParticipantIds } }).lean();
  if (usersFromMongo.length !== allParticipantIds.length) {
    throw new BadRequestError('One or more participants could not be found');
  }

  const participantsData: Record<string, ParticipantInfo> = {};
  usersFromMongo.forEach((user) => {
    participantsData[String(user._id)] = { name: user.name, email: user.email };
  });

  const conversationsCollection = getConversationsCollection();
  const conversationId = buildDirectConversationId(currentUserId, dto.participantId);

  const existing = await conversationsCollection.findOne({ _id: conversationId });
  if (existing) {
    logger.info('conversations.service.createOrGetConversation: existing conversation found', { conversationId });
    return existing;
  }

  const now = new Date();
  const readReceipts: Record<string, number> = {};
  allParticipantIds.forEach((id) => {
    readReceipts[id] = 0;
  });

  const newConversation: ConversationDoc = {
    _id: conversationId,
    type: 'direct',
    participants: allParticipantIds,
    participantsData,
    readReceipts,
    lastMessage: '',
    updatedAt: now,
    createdAt: now,
  };

  await conversationsCollection.insertOne(newConversation);

  // Seed an inbox entry for both participants so the conversation shows up
  // immediately, even before a first message is sent. Keyed by
  // conversation id (a `$set` on a map field), so re-running this is
  // naturally idempotent — no duplicate-entry risk, unlike an array `$push`.
  const inboxCollection = getUserInboxCollection();
  await Promise.all(
    allParticipantIds.map((participantId) => {
      const otherParticipantId = allParticipantIds.find((id) => id !== participantId)!;
      const entry: InboxConversationEntry = {
        conversation_id: conversationId,
        updated_at: now,
        last_message: '',
        unread_count: 0,
        name: participantsData[otherParticipantId]?.name ?? 'New chat',
        type: 'direct',
        other_user_id: otherParticipantId,
      };

      return inboxCollection.updateOne(
        { _id: participantId },
        { $set: { [`conversations.${conversationId}`]: entry } },
        { upsert: true },
      );
    }),
  );

  logger.info('conversations.service.createOrGetConversation: exit', { conversationId });
  return newConversation;
};

export const getConversationById = async (
  conversationId: string,
  requestingUserId: string,
): Promise<ConversationDoc> => {
  logger.info('conversations.service.getConversationById: entry', { conversationId });

  const conversation = await getConversationsCollection().findOne({ _id: conversationId });
  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }

  if (!conversation.participants.includes(requestingUserId)) {
    throw new ForbiddenError('You are not a participant in this conversation');
  }

  logger.info('conversations.service.getConversationById: exit', { conversationId });
  return conversation;
};

/**
 * O(1) inbox lookup — fetches the single user_inbox document for this user
 * and flattens the conversation map into a sorted array for the frontend.
 */
export const getUserInbox = async (userId: string): Promise<InboxConversationEntry[]> => {
  logger.info('conversations.service.getUserInbox: entry', { userId });

  const inboxDoc = await getUserInboxCollection().findOne({ _id: userId });
  const conversations = inboxDoc?.conversations ? Object.values(inboxDoc.conversations) : [];

  const sorted = [...conversations].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  logger.info('conversations.service.getUserInbox: exit', { userId, count: sorted.length });
  return sorted;
};

export const markConversationAsRead = async (
  conversationId: string,
  userId: string,
  lastReadMessageId: number,
): Promise<void> => {
  logger.info('conversations.service.markConversationAsRead: entry', { conversationId, userId });

  await getConversationById(conversationId, userId);

  await getConversationsCollection().updateOne(
    { _id: conversationId },
    { $set: { [`readReceipts.${userId}`]: lastReadMessageId } },
  );

  await getUserInboxCollection().updateOne(
    { _id: userId },
    { $set: { [`conversations.${conversationId}.unread_count`]: 0 } },
  );

  // The frontend only calls this when a conversation is actually open and
  // its newest message is visible — so this is exactly the "the other
  // person has seen this" signal, with no extra infrastructure needed.
  // Broadcast on the conversation channel both participants are already
  // subscribed to (no personal-channel involvement needed here).
  await publishToCentrifugo({
    channel: buildConversationChannel(conversationId),
    data: { type: 'read_receipt', conversationId, userId, lastReadMessageId },
  });

  logger.info('conversations.service.markConversationAsRead: exit', { conversationId, userId });
};
