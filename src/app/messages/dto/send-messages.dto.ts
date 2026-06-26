import { z } from 'zod';

export const sendMessageDto = z.object({
  conversationId: z.string().min(1).optional(), // optional when supplied via route param instead
  text: z.string().min(1, 'Message text cannot be empty').max(5000, 'Message text is too long'),
});

export type SendMessageDto = z.infer<typeof sendMessageDto>;
