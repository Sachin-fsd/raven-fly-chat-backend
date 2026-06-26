import { z } from 'zod';

/**
 * MVP scope: 1:1 conversations only. `participantId` is the *other* user —
 * the current user (from the auth token) is always the first participant.
 *
 * Kept deliberately narrow rather than generalized to "participantIds" +
 * "type" up front — group conversations need their own validation rules
 * (name required, 3+ participants, etc.) that don't make sense to half-bake
 * here. Adding a separate `createGroupConversationDto` later is cleaner
 * than retrofitting this one.
 */
export const createConversationDto = z.object({
  participantId: z.string().min(1, 'participantId is required'),
});

export type CreateConversationDto = z.infer<typeof createConversationDto>;
