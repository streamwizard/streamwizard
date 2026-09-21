import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

// Live role in the StreamWizard Discord. discord_live_roles holds what
// rest-api has handed out; the reconciliation sweep diffs it against
// broadcaster_live_status. Service-role only.

type DBClient = SupabaseClient<Database>;
export type DiscordLiveRoleGrant = Database["public"]["Tables"]["discord_live_roles"]["Row"];
export type DiscordLiveRoleGrantInsert = Database["public"]["Tables"]["discord_live_roles"]["Insert"];

export async function getLiveRoleGrantByBroadcaster(
  client: DBClient,
  broadcasterId: string,
): Promise<DiscordLiveRoleGrant | null> {
  const { data, error } = await client
    .from("discord_live_roles")
    .select("*")
    .eq("broadcaster_id", broadcasterId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listLiveRoleGrants(client: DBClient): Promise<DiscordLiveRoleGrant[]> {
  const { data, error } = await client.from("discord_live_roles").select("*").order("granted_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** One row per Discord user: a re-grant after a quick restart just refreshes it. */
export async function upsertLiveRoleGrant(client: DBClient, row: DiscordLiveRoleGrantInsert): Promise<void> {
  const { error } = await client.from("discord_live_roles").upsert(row, { onConflict: "discord_user_id" });

  if (error) throw error;
}

export async function deleteLiveRoleGrant(client: DBClient, discordUserId: string): Promise<void> {
  const { error } = await client.from("discord_live_roles").delete().eq("discord_user_id", discordUserId);

  if (error) throw error;
}

export interface LiveLinkedBroadcaster {
  broadcasterId: string;
  userId: string;
  discordUserId: string;
}

/**
 * Everyone who should hold the live role right now: live on Twitch, Discord
 * linked, and not switched off. Built in steps because user_preferences
 * points at auth.users, so PostgREST can't embed across it.
 */
export async function listLiveLinkedBroadcasters(client: DBClient): Promise<LiveLinkedBroadcaster[]> {
  const { data: live, error: liveError } = await client
    .from("broadcaster_live_status")
    .select("broadcaster_id")
    .eq("is_live", true);
  if (liveError) throw liveError;
  const broadcasterIds = (live ?? []).map((row) => row.broadcaster_id);
  if (broadcasterIds.length === 0) return [];

  const { data: twitch, error: twitchError } = await client
    .from("integrations_twitch")
    .select("user_id, twitch_user_id")
    .in("twitch_user_id", broadcasterIds);
  if (twitchError) throw twitchError;
  const userIds = (twitch ?? []).map((row) => row.user_id);
  if (userIds.length === 0) return [];

  const [{ data: discord, error: discordError }, { data: optedOut, error: optedOutError }] = await Promise.all([
    client.from("integrations_discord").select("user_id, discord_user_id").in("user_id", userIds),
    client.from("user_preferences").select("user_id").eq("discord_live_role", false).in("user_id", userIds),
  ]);
  if (discordError) throw discordError;
  if (optedOutError) throw optedOutError;

  const off = new Set((optedOut ?? []).map((row) => row.user_id));
  const discordByUser = new Map((discord ?? []).map((row) => [row.user_id, row.discord_user_id]));

  return (twitch ?? []).flatMap((row) => {
    const discordUserId = discordByUser.get(row.user_id);
    if (!discordUserId || off.has(row.user_id)) return [];
    return [{ broadcasterId: row.twitch_user_id, userId: row.user_id, discordUserId }];
  });
}
