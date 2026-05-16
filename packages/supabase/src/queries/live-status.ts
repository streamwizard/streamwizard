import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

type LiveStatusInsert = Database["public"]["Tables"]["broadcaster_live_status"]["Insert"];

export async function upsertBroadcasterLiveStatus(client: DBClient, data: LiveStatusInsert) {
  const { error } = await client
    .from("broadcaster_live_status")
    .upsert(data, { onConflict: "broadcaster_id" });
  if (error) throw error;
}

export async function getLiveStreamIdByBroadcasterId(
  client: DBClient,
  broadcasterId: string
): Promise<string | null> {
  const { data } = await client
    .from("broadcaster_live_status")
    .select("stream_id")
    .eq("broadcaster_id", broadcasterId)
    .eq("is_live", true)
    .maybeSingle();
  return data?.stream_id ?? null;
}
