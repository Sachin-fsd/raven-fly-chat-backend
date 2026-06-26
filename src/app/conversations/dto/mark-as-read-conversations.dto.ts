import { z } from 'zod';

export const markAsReadDto = z.object({
  lastReadMessageId: z.number().int().positive(),
});

export type MarkAsReadDto = z.infer<typeof markAsReadDto>;
