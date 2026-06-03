import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export async function getClipSync(client: DBClient, userId: string) {
  const { data } = await client
    .from("twitch_clip_syncs")
    .select("last_sync, sync_status, clip_count")
    .eq("user_id", userId)
    .single();
  return data ?? null;
}

export async function upsertClipSync(client: DBClient, userId: string, lastSync: string) {
  const { error } = await client.from("twitch_clip_syncs").insert({
    user_id: userId,
    last_sync: lastSync,
    sync_status: "syncing",
    clip_count: 0,
  });
  if (error) throw error;
}

export async function startClipSync(client: DBClient, userId: string, lastSync: string) {
  const { error } = await client
    .from("twitch_clip_syncs")
    .update({ last_sync: lastSync, sync_status: "syncing" })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function updateClipSyncStatus(client: DBClient, userId: string, status: Database["public"]["Enums"]["clip_sync_status"], clipCount?: number) {
  const patch: Database["public"]["Tables"]["twitch_clip_syncs"]["Update"] = { sync_status: status };
  if (clipCount !== undefined) patch.clip_count = clipCount;
  const { error } = await client.from("twitch_clip_syncs").update(patch).eq("user_id", userId);
  if (error) throw error;
}
