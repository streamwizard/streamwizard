import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export async function getTwitchUserId(client: DBClient): Promise<string | null> {
  const { data } = await client.from("integrations_twitch").select("twitch_user_id").single();
  return data?.twitch_user_id ?? null;
}

export async function getBroadcasterId(client: DBClient): Promise<string> {
  const { data, error } = await client.from("integrations_twitch").select("twitch_user_id").single();
  if (error || !data?.twitch_user_id) throw new Error("Failed to fetch broadcaster ID from database");
  return data.twitch_user_id;
}

export async function getUserChannelId(client: DBClient): Promise<string> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error("User not authenticated");

  const { data: twitchData, error: twitchError } = await client
    .from("integrations_twitch")
    .select("twitch_user_id")
    .eq("user_id", userData.user.id)
    .single();

  if (twitchError || !twitchData) throw new Error("Twitch integration not found");
  return twitchData.twitch_user_id;
}

export async function getUserPreferences(client: DBClient) {
  const { data, error } = await client.from("user_preferences").select("*").single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function updateUserPreferences(
  client: DBClient,
  userId: string,
  formData: Omit<Database["public"]["Tables"]["user_preferences"]["Insert"], "user_id">
) {
  const { error } = await client
    .from("user_preferences")
    .upsert({ user_id: userId, ...formData }, { onConflict: "user_id" })
    .eq("user_id", userId)
    .single();

  if (error) throw error;
}
