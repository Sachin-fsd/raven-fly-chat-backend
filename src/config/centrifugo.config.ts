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
    console.log('Publishing event to Centrifugo', { channel, data,"API KEY": env.CENTRIFUGO_API_KEY });
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
 * subscribe-proxy approach we'll reintroduce alongside presence/typing.
 */
export const generateCentrifugoConnectionToken = (userId: string, expiresInSeconds = 3600): string => {
  return jwt.sign({ sub: userId }, env.CENTRIFUGO_TOKEN_SECRET, { expiresIn: expiresInSeconds });
};
