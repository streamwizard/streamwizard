import { cache } from "react";
import { reportError } from "@repo/sentry";
import { getDiscordContext } from "./api";

// Server-only. Looks up Discord display names for tickets that don't have
// one stored (tickets from before names were saved, or people the bot never
// saw). Stored names always win; the raw id is the last resort.

export interface DiscordProfile {
  name: string;
  username: string;
  avatarUrl: string | null;
}

const lookup = cache(async (userId: string): Promise<DiscordProfile | null> => {
  const ctx = getDiscordContext();
  if (!ctx) return null;
  try {
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
  } catch (error) {
    reportError(error, "web-admin discord: user lookup", { userId });
    return null;
  }
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
  if (stored) return stored;
  if (!id) return null;
  return profiles.get(id)?.name ?? id;
}
