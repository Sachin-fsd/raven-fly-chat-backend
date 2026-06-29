import jwt from 'jsonwebtoken';
import { env } from './env.config';
import { logger } from '../logger/logger';

interface CentrifugoPublishPayload {
  channel: string;
  data: Record<string, unknown>;
}

/**
 * Publishes a real-time event to a Centrifugo channel via its REST API.
 * Fire-and-forget from the caller's perspective; errors are logged, not
 * thrown, so a Centrifugo outage never blocks the HTTP response to the
 * client. CENTRIFUGO_API_URL must include the `/api` path segment, e.g.
 * `http://localhost:8000/api` — Centrifugo's HTTP API lives at `/api/*`,
 * not at the server root.
 */
export const publishToCentrifugo = async ({ channel, data }: CentrifugoPublishPayload): Promise<void> => {
  try {
    const response = await fetch(`${env.CENTRIFUGO_API_URL}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `apikey ${env.CENTRIFUGO_API_KEY}`,
      },
      body: JSON.stringify({ channel, data }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Centrifugo responded with ${response.status}: ${text}`);
    }

    logger.debug('Published event to Centrifugo', { channel });
  } catch (error) {
    logger.error('Failed to publish to Centrifugo', { channel, error: (error as Error).message });
  }
};

/**
 * Asks Centrifugo (not our own infra) whether anyone is currently
 * subscribed to a channel — used to check if a user's personal channel has
 * an active connection, i.e. whether they're online right now. Uses
 * `presence_stats` rather than `presence` since we only need a count, not
 * the list of connected clients; requires `presence: true` on the
 * channel's namespace (set on the `personal` namespace in
 * centrifugo/config.json).
 *
 * Failure here should never block sending a message — if Centrifugo is
 * unreachable or the check fails for any reason, we just fall back to
 * treating the recipient as offline (the message still sends; the tick
 * just won't show "delivered" yet).
 */
export const isAnyoneSubscribedToChannel = async (channel: string): Promise<boolean> => {
  try {
    const response = await fetch(`${env.CENTRIFUGO_API_URL}/presence_stats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `apikey ${env.CENTRIFUGO_API_KEY}`,
      },
      body: JSON.stringify({ channel }),
    });

    if (!response.ok) {
      throw new Error(`Centrifugo responded with ${response.status}`);
    }

    const body = (await response.json()) as { result?: { num_clients?: number } };
    console.log('\n\n\n',{body},'\n\n\n')
    return (body.result?.num_clients ?? 0) > 0;
  } catch (error) {
    logger.warn('Failed to check Centrifugo presence_stats, assuming offline', {
      channel,
      error: (error as Error).message,
    });
    return false;
  }
};

/**
 * Generates a Centrifugo connection JWT for a given user, signed with the
 * same HMAC secret configured on the Centrifugo server
 * (`token_hmac_secret_key` in centrifugo's config). Centrifugo verifies
 * this locally — no round-trip back to this backend needed, which is why
 * this MVP doesn't use Centrifugo's proxy mechanism at all.
 *
 * NOTE — known limitation for this MVP: this token only proves *who* is
 * connecting, not *which channels* they're allowed to subscribe to.
 * Channel-level authorization (so user A can't subscribe to user B's
 * conversation by guessing its id) is intentionally deferred — see the
 * subscribe-proxy approach we'll reintroduce alongside typing.
 */
export const generateCentrifugoConnectionToken = (userId: string, expiresInSeconds = 3600): string => {
  return jwt.sign({ sub: userId }, env.CENTRIFUGO_TOKEN_SECRET, { expiresIn: expiresInSeconds });
};
