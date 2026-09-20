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

/**
 * Every broadcaster the table still marks live, with the stream id the
 * online handler stamped. Used to rebuild in-memory pollers after a restart.
 */
export async function getLiveBroadcasters(
  client: DBClient
): Promise<{ broadcaster_id: string; stream_id: string }[]> {
  const { data, error } = await client
    .from("broadcaster_live_status")
    .select("broadcaster_id, stream_id")
    .eq("is_live", true)
    .not("stream_id", "is", null);
  if (error) throw error;
  return (data ?? []).flatMap((row) =>
    row.stream_id ? [{ broadcaster_id: row.broadcaster_id, stream_id: row.stream_id }] : []
  );
}
