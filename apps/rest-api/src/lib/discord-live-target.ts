import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getGuildSettings, type DiscordGuildSettings } from "@repo/supabase/queries/discord";
import { getUserIdentity } from "@repo/supabase/queries/identity";
import { getUserPreferencesByUserId } from "@repo/supabase/queries/user";
import type { Database } from "@repo/supabase";
import { env } from "./env";

// What both Discord live features (the go-live post and the live role) need
// to know about a broadcaster before touching Discord: the guild's settings,
// the linked Discord account and the user's preferences. Resolved once per
// stream.online and handed to both, so the pipeline does one identity lookup.

type UserPreferences = Database["public"]["Tables"]["user_preferences"]["Row"];

export interface LiveEnv {
  botToken: string;
  guildId: string;
}

let warnedMissingEnv = false;

/** Both env vars, or nothing: every Discord live feature is off without them. */
export function liveEnv(): LiveEnv | null {
  if (env.DISCORD_BOT_TOKEN && env.DISCORD_GUILD_ID) {
    return { botToken: env.DISCORD_BOT_TOKEN, guildId: env.DISCORD_GUILD_ID };
  }
  if (!warnedMissingEnv) {
    warnedMissingEnv = true;
    console.warn("[discord-live] DISCORD_BOT_TOKEN or DISCORD_GUILD_ID missing, go-live posts and the live role are off");
  }
  return null;
}

export interface LiveTarget {
  guildId: string;
  settings: DiscordGuildSettings;
  userId: string;
  discordUserId: string;
  /** Null when the user never saved preferences: every switch is at its default (on). */
  preferences: UserPreferences | null;
}

/**
 * The guild settings, Discord id and preferences for a broadcaster, or null
 * when any Discord live feature is impossible for them: env not set, no
 * guild row, no linked Discord. Never throws; a database error is reported
 * and reads as "nothing to do".
 */
export async function resolveLiveTarget(broadcasterId: string): Promise<LiveTarget | null> {
  try {
    const live = liveEnv();
    if (!live) return null;

    const settings = await getGuildSettings(supabase, live.guildId);
    if (!settings) return null;

    const identity = await getUserIdentity(supabase, { twitchUserId: broadcasterId });
    if (!identity?.discord) return null;

    const preferences = await getUserPreferencesByUserId(supabase, identity.userId);
    return {
      guildId: live.guildId,
      settings,
      userId: identity.userId,
      discordUserId: identity.discord.userId,
      preferences: preferences ?? null,
    };
  } catch (error) {
    reportError(error, "eventsub.discord-live.resolve-target", { broadcasterUserId: broadcasterId });
    return null;
  }
}
