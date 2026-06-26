import { z } from 'zod';

export const refreshTokenDto = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required').optional(),
});

export type RefreshTokenDto = z.infer<typeof refreshTokenDto>;
