import { getMessagesCollection } from './messages.schema';
import { getConversationById } from '../conversations/conversations.service';
import { getRabbitChannel } from '../../config/rabbitmq.config';
import { publishToCentrifugo, isAnyoneSubscribedToChannel } from '../../config/centrifugo.config';
import { getCurrentBucket } from '../../utils/bucket.util';
import { env } from '../../config/env.config';
import { logger } from '../../logger/logger';
import { ChatMessageQueuePayload, MessageDoc } from '../../types/chat.types';
import { GetMessagesDto } from './dto/get-messages.dto';
import { buildPersonalChannel } from '../../utils/channel.util';

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

  const otherParticipants = conversation.participants.filter((id) => id !== senderId);

  // MVP is 1:1 only, so there's exactly one "other" participant — that
  // assumption is baked into using a single `delivered` flag on the
  // `new_message` event below. Revisit this for groups (delivered would
  // need to be per-recipient there).
  const recipientId = otherParticipants[0];
  const isRecipientOnline = recipientId
  ? await isAnyoneSubscribedToChannel(buildPersonalChannel(recipientId))
  : false;
  // console.log('\n\n\n',{recipientId, isRecipientOnline},'\n\n\n')
  const status = isRecipientOnline ? 'delivered' : 'sent';

  // Real-time delivery, fanned out once per participant over their own
  // personal channel — no separate `conversation:<id>` channel involved.
  // Every participant (sender included, for multi-device/tab sync) is
  // subscribed to their personal channel for the whole session, so this
  // single event both (a) delivers the full message to whoever has the
  // chat open and (b) drives a live inbox update for everyone else,
  // including a brand-new contact who has never opened this conversation
  // before — no REST round-trip needed either way.
  //
  // `otherUserId`/`otherUserName` are computed per-recipient (each
  // participant's "other side" is different) so the frontend can create a
  // brand-new inbox row from this event alone if it doesn't have one yet.
  await Promise.all(
    conversation.participants.map((participantId) => {
      const otherParticipantId = conversation.participants.find((id) => id !== participantId)!;
      return publishToCentrifugo({
        channel: buildPersonalChannel(participantId),
        data: {
          type: 'new_message',
          conversationId,
          messageId,
          senderId,
          text,
          createdAt: now.toISOString(),
          status,
          otherUserId: otherParticipantId,
          otherUserName: conversation.participantsData[otherParticipantId]?.name ?? 'Someone',
          conversationType: conversation.type,
        },
      });
    }),
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
    status,
  };

  const channel = getRabbitChannel();
  channel.sendToQueue(env.RABBITMQ_CHAT_QUEUE, Buffer.from(JSON.stringify(queuePayload)), {
    persistent: true,
    contentType: 'application/json',
  });

  logger.info('messages.service.sendMessage: exit (queued for async persistence)', { conversationId, messageId });
  return {
    conversationId,
    messageId,
    bucket,
    text,
    senderId,
    createdAt: now.toISOString(),
    status,
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
 *
 * When no bucket is specified and no cursor is provided (initial load),
 * this queries across multiple months starting from the current month and
 * working backwards to fetch recent history across bucket boundaries.
 */
export const getMessageHistory = async (
  conversationId: string,
  requestingUserId: string,
  dto: GetMessagesDto,
): Promise<MessageDoc[]> => {
  logger.info('messages.service.getMessageHistory: entry', { conversationId, dto });

  await getConversationById(conversationId, requestingUserId);

  // If a specific bucket is provided (pagination within a known bucket),
  // use it directly
  if (dto.bucket) {
    const filter: Record<string, unknown> = { conversation_id: conversationId, bucket: dto.bucket };
    if (dto.cursor) {
      filter.message_id = { $lt: dto.cursor };
    }

    const cursor = getMessagesCollection()
      .find(filter)
      .sort({ message_id: -1 })
      .limit(dto.limit);
    const results = await cursor.toArray();

    logger.info('messages.service.getMessageHistory: exit (single bucket)', { conversationId, bucket: dto.bucket, count: results.length });
    return results;
  }

  // Initial load without bucket: fetch across multiple months to get recent history
  // Start from current month and work backwards up to 6 months
  const results: MessageDoc[] = [];
  const currentDate = new Date();
  let remaining = dto.limit;

  for (let monthsBack = 0; monthsBack <= 6 && remaining > 0; monthsBack++) {
    const queryDate = new Date(currentDate);
    queryDate.setMonth(currentDate.getMonth() - monthsBack);
    const bucket = getCurrentBucket(queryDate);

    const filter: Record<string, unknown> = { conversation_id: conversationId, bucket };
    if (dto.cursor && monthsBack === 0) {
      filter.message_id = { $lt: dto.cursor };
    }

    const cursor = getMessagesCollection()
      .find(filter)
      .sort({ message_id: -1 })
      .limit(remaining);

    const bucketResults = await cursor.toArray();
    results.push(...bucketResults);
    remaining -= bucketResults.length;

    // If we got fewer results than requested from this bucket, continue to older buckets
    if (bucketResults.length < remaining && bucketResults.length > 0) {
      continue;
    }
    // If this bucket had results and we got enough, stop
    if (bucketResults.length > 0 && remaining <= 0) {
      break;
    }
  }

  // Sort combined results by message_id descending
  results.sort((a, b) => b.message_id - a.message_id);

  logger.info('messages.service.getMessageHistory: exit (multi-bucket)', { conversationId, count: results.length });
  return results;
};