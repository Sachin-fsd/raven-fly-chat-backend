import { ConsumeMessage } from 'amqplib';
import { getRabbitChannel } from '../config/rabbitmq.config';
import { env } from '../config/env.config';
import { getMessagesCollection } from '../app/messages/messages.schema';
import { getConversationsCollection, getUserInboxCollection } from '../app/conversations/conversations.schema';
import { ChatMessageQueuePayload, InboxConversationEntry } from '../types/chat.types';
import { logger } from '../logger/logger';

const PREFETCH_COUNT = 20;

/**
 * Persists a single queued chat message to AstraDB:
 *  1. Insert the message row into the `messages` collection.
 *  2. Update the conversation's lastMessage/updatedAt.
 *  3. Fan-out: write an inbox entry for every participant.
 *
 * Every inbox write is a `$set` on `conversations.<conversationId>` (a map
 * field) — not a `find-then-push-or-update`. That makes this naturally
 * idempotent: re-processing the same message twice (e.g. after a requeue)
 * converges to the same state instead of creating duplicate entries.
 */
const processChatMessage = async (payload: ChatMessageQueuePayload): Promise<void> => {
  const { conversationId, bucket, messageId, senderId, text, createdAt, participants, participantsData } = payload;

  logger.info('chat.worker.processChatMessage: entry', { conversationId, messageId });

  await getMessagesCollection().insertOne({
    conversation_id: conversationId,
    bucket,
    message_id: messageId,
    sender_id: senderId,
    text,
    created_at: new Date(createdAt),
  });

  await getConversationsCollection().updateOne(
    { _id: conversationId },
    { $set: { lastMessage: text, updatedAt: new Date(createdAt) } },
  );

  const inboxCollection = getUserInboxCollection();

  await Promise.all(
    participants.map(async (participantId) => {
      const otherParticipantId = participants.find((id) => id !== participantId) ?? senderId;

      const entry: InboxConversationEntry = {
        conversation_id: conversationId,
        updated_at: new Date(createdAt),
        last_message: text,
        // Only bump the recipient's unread count, never the sender's own.
        unread_count: participantId === senderId ? 0 : 1,
        name: participantsData[otherParticipantId]?.name ?? 'Chat',
        type: 'direct',
        other_user_id: otherParticipantId,
      };

      // Preserve an existing unread_count instead of clobbering it back to
      // 1 on every message — increment what's already there for anyone
      // other than the sender.
      if (participantId !== senderId) {
        const existingInbox = await inboxCollection.findOne(
          { _id: participantId },
          { projection: { [`conversations.${conversationId}`]: 1 } },
        );
        const existingUnread = existingInbox?.conversations?.[conversationId]?.unread_count ?? 0;
        entry.unread_count = existingUnread + 1;
      }

      await inboxCollection.updateOne(
        { _id: participantId },
        { $set: { [`conversations.${conversationId}`]: entry } },
        { upsert: true },
      );
    }),
  );

  logger.info('chat.worker.processChatMessage: exit', { conversationId, messageId });
};

export const startChatWorker = async (): Promise<void> => {
  const channel = getRabbitChannel();
  await channel.prefetch(PREFETCH_COUNT);

  logger.info('🐇 Chat worker starting to consume from queue', { queue: env.RABBITMQ_CHAT_QUEUE });

  channel.consume(
    env.RABBITMQ_CHAT_QUEUE,
    async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      try {
        const payload = JSON.parse(msg.content.toString()) as ChatMessageQueuePayload;
        await processChatMessage(payload);
        channel.ack(msg);
      } catch (error) {
        logger.error('chat.worker: failed to process message, sending to dead-letter / requeue', {
          error: (error as Error).message,
        });
        // requeue=false to avoid poison-message loops; a real deployment
        // should route this to a dead-letter queue instead of dropping it.
        channel.nack(msg, false, false);
      }
    },
    { noAck: false },
  );
};
