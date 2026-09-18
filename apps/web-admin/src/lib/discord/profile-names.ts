// Client-safe: no env, no Discord token. The lookups live in ./users (server only).

export interface DiscordProfile {
  name: string;
  username: string;
  avatarUrl: string | null;
}

/** Stored name, then the looked-up name, then the id. */
export function displayName(
  stored: string | null | undefined,
  id: string | null | undefined,
  profiles: Record<string, DiscordProfile>,
): string | null {
  if (stored) return stored;
  if (!id) return null;
  return profiles[id]?.name ?? id;
}
