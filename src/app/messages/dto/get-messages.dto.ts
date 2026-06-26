import { z } from 'zod';

export const getMessagesDto = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  bucket: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  // Capped at 20 — AstraDB's Data API only returns up to 20 documents for
  // an explicitly-sorted, non-vector query before it stops (see
  // messages.service.ts for why we need the sort in the first place).
  limit: z.coerce.number().int().min(1).max(20).default(20),
});

export type GetMessagesDto = z.infer<typeof getMessagesDto>;
