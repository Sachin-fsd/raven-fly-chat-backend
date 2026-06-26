import { Collection } from '@datastax/astra-db-ts';
import { getAstraDb, ASTRA_COLLECTIONS } from '../../config/astra.config';
import { ConversationDoc, UserInboxDoc } from '../../types/chat.types';

export const getConversationsCollection = (): Collection<ConversationDoc> => {
  return getAstraDb().collection<ConversationDoc>(ASTRA_COLLECTIONS.CONVERSATIONS);
};

export const getUserInboxCollection = (): Collection<UserInboxDoc> => {
  return getAstraDb().collection<UserInboxDoc>(ASTRA_COLLECTIONS.USER_INBOX);
};
