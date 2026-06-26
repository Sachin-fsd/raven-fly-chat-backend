import { z } from 'zod';

export const getInboxDto = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type GetInboxDto = z.infer<typeof getInboxDto>;
