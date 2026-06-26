import { Collection } from '@datastax/astra-db-ts';
import { getAstraDb, ASTRA_COLLECTIONS } from '../../config/astra.config';
import { MessageDoc } from '../../types/chat.types';

export const getMessagesCollection = (): Collection<MessageDoc> => {
  return getAstraDb().collection<MessageDoc>(ASTRA_COLLECTIONS.MESSAGES);
};
