import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import { getUserIdentity } from "./identity";

type DBClient = SupabaseClient<Database>;

export async function getUserPreferences(client: DBClient) {
  const { data, error } = await client.from("user_preferences").select("*").single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

/** The signed-in user's Twitch identity (RLS-scoped), for UI that names the channel. */
export async function getTwitchProfile(client: DBClient) {
  const { data } = await client.from("integrations_twitch").select("twitch_user_id, twitch_username").maybeSingle();
  return data;
}

/** Twitch usernames by user id, for showing who did something. Users without Twitch are left out. */
export async function getTwitchUsernames(client: DBClient, userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Map();
  const { data, error } = await client.from("integrations_twitch").select("user_id, twitch_username").in("user_id", ids);
  if (error) throw error;
  return new Map(data.map((row) => [row.user_id, row.twitch_username]));
}

/**
 * users.name by user id. For columns that reference auth.users (created_by,
 * changed_by), which PostgREST can't embed the profile through.
 */
export async function getUserNames(client: DBClient, userIds: string[]): Promise<Map<string, string | null>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const { data, error } = await client.from("users").select("id, name").in("id", ids);
  if (error) throw error;
  return new Map(data.map((user) => [user.id, user.name]));
}

export async function getTwitchUsernameByUserId(client: DBClient, userId: string): Promise<string | null> {
  const { data } = await client.from("integrations_twitch").select("twitch_username").eq("user_id", userId).maybeSingle();
  return data?.twitch_username ?? null;
}

/**
 * Wipes every row the user owns (see the delete_user_data function) and
 * returns the auth user id so the caller can delete the account itself.
 * Null data means no such Twitch user, already gone or never registered.
 * `actorUserId` names the admin in the user.deleted event (reason "admin").
 */
export async function deleteUserData(client: DBClient, twitchUserId: string, reason?: string, actorUserId?: string) {
  return client.rpc("delete_user_data", {
    p_twitch_user_id: twitchUserId,
    ...(reason ? { p_reason: reason } : {}),
    ...(actorUserId ? { p_actor_user_id: actorUserId } : {}),
  });
}

/** The user's Twitch id, or null when they have no Twitch link. Throws on a failed read. */
export async function getTwitchUserIdByUserId(client: DBClient, userId: string): Promise<string | null> {
  const { data, error } = await client
    .from("integrations_twitch")
    .select("twitch_user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.twitch_user_id?.trim() || null;
}

/** getTwitchUserIdByUserId for callers that treat a failed read like "no Twitch link". */
export function getTwitchUserIdByUserIdMaybe(client: DBClient, userId: string): Promise<string | null> {
  return getTwitchUserIdByUserId(client, userId).catch(() => null);
}

export async function updateTwitchTokens(
  client: DBClient,
  userId: string,
  tokens: {
    access_token_ciphertext: string;
    access_token_iv: string;
    access_token_tag: string;
    refresh_token_ciphertext: string;
    refresh_token_iv: string;
    refresh_token_tag: string;
  },
) {
  return client.from("integrations_twitch").update(tokens).eq("user_id", userId);
}

export async function getTwitchIntegrationWithTokenByUserId(client: DBClient, userId: string) {
  return client
    .from("integrations_twitch")
    .select("twitch_user_id, access_token_ciphertext")
    .eq("user_id", userId)
    .single();
}

export async function getAllTwitchIntegrations(client: DBClient) {
  const { data, error } = await client.from("integrations_twitch").select("twitch_user_id, user_id");
  if (error) throw error;
  return data ?? [];
}

export async function getTwitchIntegrationByBroadcasterId(client: DBClient, broadcasterId: string) {
  return client.from("integrations_twitch").select("user_id").eq("twitch_user_id", broadcasterId).single();
}

export async function getDiscordIntegrationByUserId(client: DBClient, userId: string) {
  return client.from("integrations_discord").select("discord_user_id, discord_username").eq("user_id", userId).single();
}

/** The user's linked Discord id, or null when they have none. Throws on a failed read. */
export async function getDiscordUserIdByUserId(client: DBClient, userId: string): Promise<string | null> {
  const { data, error } = await client.from("integrations_discord").select("discord_user_id").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data?.discord_user_id ?? null;
}

export type TwitchLink = Pick<Database["public"]["Tables"]["integrations_twitch"]["Row"], "twitch_user_id" | "twitch_scopes">;

/** The user's Twitch id and granted scopes, or null when they have no Twitch link. Throws on a failed read. */
export async function getTwitchLinkByUserId(client: DBClient, userId: string): Promise<TwitchLink | null> {
  const { data, error } = await client
    .from("integrations_twitch")
    .select("twitch_user_id, twitch_scopes")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAllDiscordIntegrations(client: DBClient) {
  const { data, error } = await client.from("integrations_discord").select("discord_user_id, user_id");
  if (error) throw error;
  return data ?? [];
}

export async function linkDiscordIntegration(
  client: DBClient,
  profile: {
    discord_user_id: string;
    discord_username: string;
    avatar: string | null;
    email: string | null;
  },
) {
  const { error } = await client.rpc("link_discord_integration", {
    p_discord_user_id: profile.discord_user_id,
    p_discord_username: profile.discord_username,
    p_avatar: profile.avatar ?? "",
    p_email: profile.email ?? "",
  });

  if (error) throw error;
}

export async function deleteDiscordIntegration(client: DBClient, userId: string) {
  const { error } = await client.from("integrations_discord").delete().eq("user_id", userId);
  if (error) throw error;
}

export async function getUserPreferencesByUserId(client: DBClient, userId: string) {
  const { data, error } = await client.from("user_preferences").select("*").eq("user_id", userId).single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function updateUserPreferences(
  client: DBClient,
  userId: string,
  formData: Omit<Database["public"]["Tables"]["user_preferences"]["Insert"], "user_id">,
) {
  const { error } = await client
    .from("user_preferences")
    .upsert({ user_id: userId, ...formData }, { onConflict: "user_id" })
    .eq("user_id", userId)
    .single();

  if (error) throw error;
}

/** Name and Twitch avatar for showing who did something, or null for an unknown user. */
export async function getUserDisplayProfile(
  client: DBClient,
  userId: string,
): Promise<{ name: string; avatarUrl: string | null } | null> {
  const identity = await getUserIdentity(client, { userId });
  if (!identity) return null;
  return { name: identity.name, avatarUrl: identity.twitch?.profileImageUrl ?? null };
}
