import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

/**
 * The scopes on the signed-in user's Twitch token (RLS picks the row). Null
 * when the token has not been validated since the column was added; see
 * missingTwitchScopes in @repo/schemas for how callers read that.
 */
export async function getTwitchScopes(client: DBClient): Promise<string[] | null> {
  const { data } = await client.from("integrations_twitch").select("twitch_scopes").maybeSingle();
  return data?.twitch_scopes ?? null;
}

export async function getTwitchScopesByBroadcasterId(client: DBClient, twitchUserId: string): Promise<string[] | null> {
  const { data } = await client.from("integrations_twitch").select("twitch_scopes").eq("twitch_user_id", twitchUserId).maybeSingle();
  return data?.twitch_scopes ?? null;
}

export async function setTwitchScopesByUserId(client: DBClient, userId: string, scopes: string[]) {
  return client
    .from("integrations_twitch")
    .update({ twitch_scopes: scopes, scopes_synced_at: new Date().toISOString() })
    .eq("user_id", userId);
}

export async function setTwitchScopesByBroadcasterId(client: DBClient, twitchUserId: string, scopes: string[]) {
  return client
    .from("integrations_twitch")
    .update({ twitch_scopes: scopes, scopes_synced_at: new Date().toISOString() })
    .eq("twitch_user_id", twitchUserId);
}

/** Every integration holding a token, for the hourly validation sweep. */
export async function listTwitchIntegrationsWithToken(client: DBClient): Promise<{ twitch_user_id: string }[]> {
  const { data, error } = await client
    .from("integrations_twitch")
    .select("twitch_user_id")
    .not("access_token_ciphertext", "is", null);
  if (error) throw error;
  return data ?? [];
}
