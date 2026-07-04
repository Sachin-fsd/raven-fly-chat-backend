/**
 * Centrifugo channel naming convention shared by every module that
 * publishes or subscribes to real-time events.
 *
 * There is deliberately no `conversation:<id>` channel anymore — every
 * durable event (new_message, read_receipt) fans out once per participant
 * over their own personal channel instead of a shared per-conversation
 * topic clients had to subscribe/unsubscribe to on open/close. If a
 * genuinely ephemeral, no-durability-needed feature shows up later (e.g.
 * typing indicators scoped to "both people have this exact chat open right
 * now"), that's the one case where a short-lived `conversation:<id>`-style
 * channel would still make sense — but message delivery itself doesn't
 * need it.
 */
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