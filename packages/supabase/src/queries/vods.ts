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

export async function insertVod(client: DBClient, vod: Database["public"]["Tables"]["vods"]["Insert"]) {
  const { error } = await client.from("vods").insert(vod);
  if (error) throw error;
}

export async function getVodsByVideoIds(client: DBClient, videoIds: string[]) {
  if (!videoIds.length) return new Set<string>();
  const { data, error } = await client.from("vods").select("video_id").in("video_id", videoIds);
  if (error) throw error;
  return new Set((data ?? []).map((v) => v.video_id));
}

export async function getPendingClips(client: DBClient, batchSize: number, maxRetries: number) {
  const { data, error } = await client
    .from("pending_clips")
    .select(`*, integrations_twitch!broadcaster_id (user_id)`)
    .eq("status", "pending")
    .lte("next_retry_at", new Date().toISOString())
    .lt("retry_count", maxRetries)
    .order("created_at", { ascending: true })
    .limit(batchSize);
  if (error) throw error;
  return data ?? [];
}

export async function updatePendingClipsReady(client: DBClient, clipIds: string[]) {
  const { error } = await client
    .from("pending_clips")
    .update({ status: "ready", last_checked_at: new Date().toISOString() })
    .in("clip_id", clipIds);
  if (error) throw error;
}

export async function updatePendingClipRetry(
  client: DBClient,
  clipId: string,
  retryCount: number,
  nextRetryAt: string,
  status: "pending" | "failed"
) {
  const { error } = await client
    .from("pending_clips")
    .update({ retry_count: retryCount, last_checked_at: new Date().toISOString(), next_retry_at: nextRetryAt, status })
    .eq("clip_id", clipId);
  if (error) throw error;
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
