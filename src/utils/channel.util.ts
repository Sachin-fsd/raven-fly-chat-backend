/**
 * Centrifugo channel naming convention shared by every module that
 * publishes or subscribes to conversation events.
 */
export const buildConversationChannel = (conversationId: string): string => `conversation:${conversationId}`;

/**
 * Every logged-in user subscribes to exactly one of these for their whole
 * session. The `#` is Centrifugo's built-in "user-limited channel" syntax —
 * only the user whose id appears after `#` is allowed to subscribe to it,
 * enforced by Centrifugo itself (no backend round-trip needed), as long as
 * `allow_user_limited_channels` is enabled for the `personal` namespace.
 *
 * This solves the "new conversation never shows up live" gap: a user is
 * subscribed to their personal channel from the moment they connect,
 * regardless of which conversations exist yet — unlike `conversation:<id>`
 * channels, which they only subscribe to for conversations already in
 * their inbox.
 */
export const buildPersonalChannel = (userId: string): string => `personal:#${userId}`;
