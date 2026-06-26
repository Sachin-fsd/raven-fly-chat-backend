/**
 * Returns the current bucket string in YYYY-MM format, used as part of
 * the Cassandra/AstraDB messages partitioning strategy.
 */
export const getCurrentBucket = (date: Date = new Date()): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * Deterministically builds a direct-conversation id from two user ids,
 * independent of the order they're passed in (so A->B and B->A resolve
 * to the same conversation).
 */
export const buildDirectConversationId = (userIdA: string, userIdB: string): string => {
  const [first, second] = [userIdA, userIdB].sort();
  return `direct_${first}_${second}`;
};
