import { z } from 'zod';

export const searchUsersDto = z.object({
  q: z.string().min(1, 'Search query is required').max(200),
});

export type SearchUsersDto = z.infer<typeof searchUsersDto>;
