import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

// One place that reads "who is this user" across users, integrations_twitch
// and integrations_discord. Every other shape (platform event identity, public
// Twitch profile, display profile, linked account) is a pure mapper over it,
// so the rules live once. The SQL twin is platform_event_identity(uuid).

export interface UserIdentity {
  userId: string;
  /** users.name. Falls back to the email at signup, so check before showing it. */
  name: string;
  email: string;
  /** users.avatar_url, the non-Twitch fallback. */
  avatarUrl: string | null;
  twitch: {
    userId: string;
    username: string;
    profileImageUrl: string | null;
    broadcasterType: string | null;
  } | null;
  discord: {
    userId: string;
    username: string | null;
  } | null;
}

export type IdentityLookup = { userId: string } | { discordUserId: string } | { twitchUserId: string };

async function resolveUserId(client: DBClient, by: IdentityLookup): Promise<string | null> {
  if ("userId" in by) return by.userId;
  if ("discordUserId" in by) {
    const { data, error } = await client
      .from("integrations_discord")
      .select("user_id")
      .eq("discord_user_id", by.discordUserId)
      .maybeSingle();
    if (error) throw error;
    return data?.user_id ?? null;
  }
  const { data, error } = await client
    .from("integrations_twitch")
    .select("user_id")
    .eq("twitch_user_id", by.twitchUserId)
    .maybeSingle();
  if (error) throw error;
  return data?.user_id ?? null;
}

/**
 * The user behind a StreamWizard, Discord or Twitch id, or null when nothing
 * matches. Never returns tokens.
 */
export async function getUserIdentity(client: DBClient, by: IdentityLookup): Promise<UserIdentity | null> {
  const userId = await resolveUserId(client, by);
  if (!userId) return null;

  const [user, twitch, discord] = await Promise.all([
    client.from("users").select("id, name, email, avatar_url").eq("id", userId).maybeSingle(),
    client
      .from("integrations_twitch")
      .select("twitch_user_id, twitch_username, profile_image_url, broadcaster_type")
      .eq("user_id", userId)
      .maybeSingle(),
    client.from("integrations_discord").select("discord_user_id, discord_username").eq("user_id", userId).maybeSingle(),
  ]);
  if (user.error) throw user.error;
  if (twitch.error) throw twitch.error;
  if (discord.error) throw discord.error;
  if (!user.data) return null;

  return {
    userId: user.data.id,
    name: user.data.name,
    email: user.data.email,
    avatarUrl: user.data.avatar_url,
    twitch: twitch.data
      ? {
          userId: twitch.data.twitch_user_id,
          username: twitch.data.twitch_username,
          profileImageUrl: twitch.data.profile_image_url,
          broadcasterType: twitch.data.broadcaster_type,
        }
      : null,
    discord: discord.data ? { userId: discord.data.discord_user_id, username: discord.data.discord_username } : null,
  };
}

// ── Mappers ─────────────────────────────────────────────────────────────────

/** Twitch profile picture first, then the StreamWizard avatar. */
export function identityAvatarUrl(identity: UserIdentity): string | null {
  return identity.twitch?.profileImageUrl ?? identity.avatarUrl ?? null;
}

/**
 * A name safe to show without Twitch: users.name unless it's the email
 * fallback. Same rule as platform_event_identity in SQL.
 */
export function identityDisplayName(identity: UserIdentity): string | null {
  if (identity.twitch) return null;
  const name = identity.name?.trim();
  return name && !name.includes("@") ? name : null;
}
