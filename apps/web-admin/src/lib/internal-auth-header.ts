import { signServiceToken, type ServiceScope } from "@repo/service-token";
import { env } from "@/lib/env";

/**
 * The Authorization header for one call into rest-api /internal/* or the
 * discord-bot API, or null when this deployment can't make that call.
 *
 * Server-only. Signs a fresh 60-second service token for `scope` with
 * WS_SERVICE_SIGNING_JWK (rest-api and the bot check it against web-admin's
 * public key). While the old shared secret is still set for that service it
 * is sent instead, so this can ship before the receiving side has its key
 * set. Deleting the secret from this app's config switches to tokens
 * (SW-494); the next release removes the secrets.
 */
export async function internalAuthHeader(scope: ServiceScope, legacySecret: string | undefined): Promise<string | null> {
  if (legacySecret) return `Bearer ${legacySecret}`;
  if (!env.WS_SERVICE_SIGNING_JWK) return null;
  return `Bearer ${await signServiceToken(scope)}`;
}

/** True when internalAuthHeader() can produce a header for that service. */
export function canCallInternal(legacySecret: string | undefined): boolean {
  return Boolean(legacySecret || env.WS_SERVICE_SIGNING_JWK);
}
