import { getMessagesCollection } from './messages.schema';
import { getConversationById } from '../conversations/conversations.service';
import { getRabbitChannel } from '../../config/rabbitmq.config';
import { publishToCentrifugo, isAnyoneSubscribedToChannel } from '../../config/centrifugo.config';
import { getCurrentBucket } from '../../utils/bucket.util';
import { env } from '../../config/env.config';
import { logger } from '../../logger/logger';
import { ChatMessageQueuePayload, MessageDoc } from '../../types/chat.types';
import { GetMessagesDto } from './dto/get-messages.dto';
import { buildConversationChannel, buildPersonalChannel } from '../../utils/channel.util';

interface SendMessageResult {
  conversationId: string;
  messageId: number;
  bucket: string;
  text: string;
  senderId: string;
  createdAt: string;
  status: 'sent' | 'delivered';
}

/**
 * Handles the "send message" flow:
 *  1. Validate the sender is a participant of the conversation.
 *  2. Compute the current bucket + a strictly increasing message_id.
 *  3. Check whether the recipient is online (Centrifugo presence_stats on
 *     their personal channel) to decide sent vs. delivered.
 *  4. Publish to Centrifugo immediately for real-time delivery.
 *  5. Push the durable-write payload onto RabbitMQ (fire-and-forget).
 *  6. Return success to the caller without waiting on AstraDB.
 */
export const sendMessage = async (
  conversationId: string,
  senderId: string,
  text: string,
): Promise<SendMessageResult> => {
  logger.info('messages.service.sendMessage: entry', { conversationId, senderId });

  const conversation = await getConversationById(conversationId, senderId);

  const now = new Date();
  const bucket = getCurrentBucket(now);
  const messageId = now.getTime();

  const channelName = buildConversationChannel(conversationId);
  const senderName = conversation.participantsData[senderId]?.name ?? 'Someone';
  const otherParticipants = conversation.participants.filter((id) => id !== senderId);

  // MVP is 1:1 only, so there's exactly one "other" participant — that
  // assumption is baked into using a single `delivered` flag on the
  // `new_message` event below. Revisit this for groups (delivered would
  // need to be per-recipient there).
  const recipientId = otherParticipants[0];
  const isRecipientOnline = recipientId
  ? await isAnyoneSubscribedToChannel(buildPersonalChannel(recipientId))
  : false;
  console.log('\n\n\n',{recipientId, isRecipientOnline},'\n\n\n')

  // Step 1: Real-time delivery via Centrifugo — happens instantly, independent
  // of whether the durable write below has completed.
  await publishToCentrifugo({
    channel: channelName,
    data: {
      type: 'new_message',
      conversationId,
      messageId,
      senderId,
      text,
      createdAt: now.toISOString(),
      status: isRecipientOnline ? 'delivered' : 'sent',
    },
  });

  // Step 1b: Also notify every *other* participant's personal channel.
  // This is what makes the inbox update live for a brand-new conversation —
  // the recipient is subscribed to their personal channel from the moment
  // they connect, regardless of whether they're subscribed to this specific
  // `conversation:<id>` channel yet (they only subscribe to those for
  // conversations already in their inbox). Without this, a first message
  // from a new contact would only ever show up after a manual refresh.
  await Promise.all(
    otherParticipants.map((participantId) =>
      publishToCentrifugo({
        channel: buildPersonalChannel(participantId),
        data: {
          type: 'inbox_update',
          conversationId,
          lastMessage: text,
          updatedAt: now.toISOString(),
          senderId,
          // Lets the frontend render a brand-new inbox row immediately,
          // without waiting on a REST refetch to learn who the other
          // participant is.
          otherUserId: senderId,
          otherUserName: senderName,
          conversationType: conversation.type,
        },
      }),
    ),
  );

  // Step 2: Queue the durable write + fan-out for the RabbitMQ worker.
  const queuePayload: ChatMessageQueuePayload = {
    conversationId,
    bucket,
    messageId,
    senderId,
    text,
    createdAt: now.toISOString(),
    participants: conversation.participants,
    participantsData: conversation.participantsData,
    conversationType: conversation.type,
    status: isRecipientOnline ? 'delivered' : 'sent',
  };

  const channel = getRabbitChannel();
  channel.sendToQueue(env.RABBITMQ_CHAT_QUEUE, Buffer.from(JSON.stringify(queuePayload)), {
    persistent: true,
    contentType: 'application/json',
  });

  logger.info('messages.service.sendMessage: exit (queued for async persistence)', { conversationId, messageId });
  console.log({text, isRecipientOnline})
  return {
    conversationId,
    messageId,
    bucket,
    text,
    senderId,
    createdAt: now.toISOString(),
    status: isRecipientOnline ? 'delivered' : 'sent',
  };
};

/**
 * Cursor-based history fetch, explicitly sorted by `message_id` descending.
 *
 * Earlier version of this skipped the `sort` option on the assumption that
 * AstraDB's Data API would return documents in physical/insertion order
 * (true for a raw Cassandra clustering column, which is what this design
 * was modeled on). That assumption was wrong for the Data API's generic
 * document Collection — without an explicit sort, document order is
 * undefined, which is exactly why messages were coming back out of order.
 *
 * The Data API caps non-vector *sorted* queries at 20 documents per
 * request (it picks the top-N matching the sort criterion and stops,
 * rather than paginating further) — that's why MAX_PAGE_SIZE is 20, not
 * the 100 it used to allow.
 */
export const getMessageHistory = async (
  conversationId: string,
  requestingUserId: string,
  dto: GetMessagesDto,
): Promise<MessageDoc[]> => {
  logger.info('messages.service.getMessageHistory: entry', { conversationId, dto });

  await getConversationById(conversationId, requestingUserId);

  const bucket = dto.bucket ?? getCurrentBucket();

  const filter: Record<string, unknown> = { conversation_id: conversationId, bucket };
  if (dto.cursor) {
    filter.message_id = { $lt: dto.cursor };
  }

  const cursor = getMessagesCollection()
    .find(filter)
    .sort({ message_id: -1 })
    .limit(dto.limit);
  const results = await cursor.toArray();

  logger.info('messages.service.getMessageHistory: exit', { conversationId, count: results.length });
  return results;
};
