const PREFIX = "Bearer ";

/**
 * The token from an `Authorization: Bearer <token>` header, or null when the
 * header is missing or uses another scheme. The scheme match is case-sensitive
 * and the token is returned as sent (not trimmed); callers that want to refuse
 * an empty token check for it themselves.
 */
export function readBearerToken(header: string | null | undefined): string | null {
  return header?.startsWith(PREFIX) ? header.slice(PREFIX.length) : null;
}
