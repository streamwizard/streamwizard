import { cache } from "react";
import { DiscordRateLimitError } from "@repo/discord-api";
import { reportError } from "@repo/sentry";
import { getDiscordContext } from "./api";

// Server-only. Looks up Discord display names for tickets that don't have
// one stored (tickets from before names were saved, or people the bot never
// saw). Stored names always win; the raw id is the last resort.

import { displayName as displayNameFromRecord, type DiscordProfile } from "./profile-names";

export type { DiscordProfile };

// Discord allows 5 member fetches per second per guild, and a ticket page
// re-renders on every action, websocket ping and poll. So profiles are kept
// across requests for a while, in-flight lookups are shared, and only a few
// run at once.
const HIT_TTL_MS = 10 * 60_000;
const MISS_TTL_MS = 60_000;
const MAX_ENTRIES = 2000;
const MAX_CONCURRENT = 4;

const store = new Map<string, { profile: DiscordProfile | null; expires: number }>();
const inflight = new Map<string, Promise<DiscordProfile | null>>();

let active = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(run: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
  active += 1;
  try {
    return await run();
  } finally {
    active -= 1;
    waiting.shift()?.();
  }
}

function remember(userId: string, profile: DiscordProfile | null): DiscordProfile | null {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(userId, { profile, expires: Date.now() + (profile ? HIT_TTL_MS : MISS_TTL_MS) });
  return profile;
}

async function fetchProfile(userId: string): Promise<DiscordProfile | null> {
  const ctx = getDiscordContext();
  if (!ctx) return null;
  // Server nickname when they're still a member, otherwise their global profile.
  const member = await ctx.api.guilds.getMember(userId);
  const user = member?.user ?? (await ctx.api.guilds.getUser(userId));
  if (!user) return null;
  const avatarHash = member?.avatar ?? user.avatar;
  const avatarUrl = !avatarHash
    ? null
    : member?.avatar
      ? `https://cdn.discordapp.com/guilds/${ctx.guildId}/users/${user.id}/avatars/${avatarHash}.png?size=64`
      : `https://cdn.discordapp.com/avatars/${user.id}/${avatarHash}.png?size=64`;
  return { name: member?.nick ?? user.global_name ?? user.username, username: user.username, avatarUrl };
}

const lookup = cache(async (userId: string): Promise<DiscordProfile | null> => {
  const hit = store.get(userId);
  if (hit && hit.expires > Date.now()) return hit.profile;

  const pending = inflight.get(userId);
  if (pending) return pending;

  const job = withSlot(() => fetchProfile(userId))
    .then((profile) => remember(userId, profile))
    .catch((error: unknown) => {
      // The client already waited out short limits; a long one isn't worth a
      // Sentry issue, the page falls back to the stored name or id. Keep the
      // stale profile if there is one rather than showing a raw id.
      if (error instanceof DiscordRateLimitError) console.warn(`[web-admin discord: user lookup] ${error.message}`);
      else reportError(error, "web-admin discord: user lookup", { userId });
      return hit?.profile ?? null;
    })
    .finally(() => inflight.delete(userId));
  inflight.set(userId, job);
  return job;
});

const SNOWFLAKE = /^\d{17,20}$/;

/** Profiles for the given ids; ids that can't be resolved are left out. */
export async function resolveDiscordProfiles(ids: (string | null | undefined)[]): Promise<Map<string, DiscordProfile>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id && SNOWFLAKE.test(id)))];
  const profiles = await Promise.all(unique.map(async (id) => [id, await lookup(id)] as const));
  return new Map(profiles.filter((entry): entry is readonly [string, DiscordProfile] => entry[1] !== null));
}

/** Stored name, then the looked-up name, then the id. */
export function displayName(
  stored: string | null | undefined,
  id: string | null | undefined,
  profiles: Map<string, DiscordProfile>,
): string | null {
  return displayNameFromRecord(stored, id, Object.fromEntries(profiles));
}
