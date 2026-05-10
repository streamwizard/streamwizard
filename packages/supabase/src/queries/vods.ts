import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export async function getStreamData(client: DBClient, videoId: string) {
  const { data, error } = await client.rpc("get_stream_data", { p_video_id: videoId });
  if (error) throw error;
  const result = data as { stream_events: unknown[]; clips: unknown[] };
  return { events: result.stream_events ?? [], clips: result.clips ?? [] };
}

export async function getCurrentStreamDetails(client: DBClient, broadcasterId: string): Promise<string | null> {
  const { data, error } = await client
    .from("broadcaster_live_status")
    .select("is_live, stream_id")
    .eq("broadcaster_id", broadcasterId)
    .single();

  if (error || !data?.is_live) return null;
  return data.stream_id;
}

export async function createPendingClip(client: DBClient, clipId: string, broadcasterId: string) {
  const { error } = await client.from("pending_clips").insert([{
    id: crypto.randomUUID(),
    clip_id: clipId,
    broadcaster_id: broadcasterId,
    status: "pending",
    retry_count: 0,
    max_retries: 20,
    created_at: new Date().toISOString(),
    last_checked_at: null,
    next_retry_at: new Date().toISOString(),
    error_message: null,
  }]);

  if (error) throw error;
}
