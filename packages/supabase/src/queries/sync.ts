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

export type ClipSyncClaim =
  | { claimed: true }
  | { claimed: false; lastSync: string | null; status: Database["public"]["Enums"]["clip_sync_status"] | null };

/**
 * Starts a sync for the user if one is allowed, in a single conditional write
 * so two requests at once can't both get through.
 *
 * Allowed when the user has no sync row yet, the last sync failed, or the last
 * one started more than `cooldownMs` ago. A sync still marked "syncing" past the
 * cooldown counts as dead (the process went away) and can be taken over.
 */
export async function claimClipSync(client: DBClient, userId: string, now: Date, cooldownMs: number): Promise<ClipSyncClaim> {
  const startedAt = now.toISOString();
  const cutoff = new Date(now.getTime() - cooldownMs).toISOString();

  const { data: updated, error: updateError } = await client
    .from("twitch_clip_syncs")
    .update({ last_sync: startedAt, sync_status: "syncing" })
    .eq("user_id", userId)
    .or(`sync_status.eq.failed,last_sync.lt.${cutoff}`)
    .select("id");
  if (updateError) throw updateError;
  if (updated.length > 0) return { claimed: true };

  // Nothing matched: either there's no row yet, or a sync is running or ran
  // recently. ignoreDuplicates makes the insert a no-op in the second case.
  const { data: inserted, error: insertError } = await client
    .from("twitch_clip_syncs")
    .upsert(
      { user_id: userId, last_sync: startedAt, sync_status: "syncing", clip_count: 0 },
      { onConflict: "user_id", ignoreDuplicates: true },
    )
    .select("id");
  if (insertError) throw insertError;
  if (inserted.length > 0) return { claimed: true };

  const current = await getClipSync(client, userId);
  return { claimed: false, lastSync: current?.last_sync ?? null, status: current?.sync_status ?? null };
}

/**
 * Marks a sync completed or failed. The status change fires the
 * `clips.sync_*` platform events, so `error` ends up in the log channel.
 */
export async function updateClipSyncStatus(
  client: DBClient,
  userId: string,
  status: Database["public"]["Enums"]["clip_sync_status"],
  clipCount?: number,
  lastError?: string | null,
) {
  const patch: Database["public"]["Tables"]["twitch_clip_syncs"]["Update"] = {
    sync_status: status,
    last_error: status === "failed" ? (lastError ?? null) : null,
  };
  if (clipCount !== undefined) patch.clip_count = clipCount;
  const { error } = await client.from("twitch_clip_syncs").update(patch).eq("user_id", userId);
  if (error) throw error;
}
