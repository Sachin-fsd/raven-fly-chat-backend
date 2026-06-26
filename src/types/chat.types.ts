export type ConversationType = 'direct' | 'group';

export interface ParticipantInfo {
  name: string;
  email: string;
}

export interface ConversationDoc {
  _id: string;
  type: ConversationType;
  /** Only set for `type: 'group'` — direct conversations derive their
   *  display name from the other participant's profile instead. */
  name?: string;
  participants: string[];
  participantsData: Record<string, ParticipantInfo>;
  readReceipts: Record<string, number>;
  lastMessage: string;
  updatedAt: Date;
  createdAt: Date;
}

export interface MessageDoc {
  conversation_id: string;
  bucket: string;
  message_id: number;
  sender_id: string;
  text: string;
  created_at: Date;
}

export interface InboxConversationEntry {
  conversation_id: string;
  updated_at: Date;
  last_message: string;
  unread_count: number;
  name: string;
  type: ConversationType;
  /** Only set for `direct` conversations — the other participant's user id,
   *  needed by the frontend to look up their presence (online/offline). */
  other_user_id?: string;
}

export interface UserInboxDoc {
  _id: string;
  /**
   * Keyed by conversation id rather than stored as an array. AstraDB's Data
   * API doesn't reliably support matching/updating a single element inside
   * an array of sub-documents by a nested field (e.g.
   * `{ 'conversations.conversation_id': x }`), which is exactly what the
   * previous array-based design needed on every message send. When that
   * match silently failed, the fallback path pushed a brand new entry
   * instead of updating the existing one — producing duplicate sidebar
   * rows. A map makes "create or update this conversation's inbox entry"
   * a single, always-correct `$set` on a known key path, with no
   * search-then-branch logic at all.
   */
  conversations: Record<string, InboxConversationEntry>;
}

export interface ChatMessageQueuePayload {
  conversationId: string;
  bucket: string;
  messageId: number;
  senderId: string;
  text: string;
  createdAt: string;
  participants: string[];
  participantsData: Record<string, ParticipantInfo>;
  conversationType: ConversationType;
}
