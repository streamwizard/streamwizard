import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";
import { withMetrics } from "./with-metrics";

/** Media-library rows: streamer-uploaded overlay assets and their storage usage. */

type DBClient = SupabaseClient<Database>;

export const selectStorageUsage = withMetrics(
  "user_storage_usage",
  "select",
  async (client: DBClient, userId: string) =>
    client.from("user_storage_usage").select("used_bytes").eq("user_id", userId).maybeSingle(),
);

export const selectReadyAssets = withMetrics(
  "user_assets",
  "select",
  async (client: DBClient, userId: string) =>
    client
      .from("user_assets")
      .select("id, key, file_name, mime_type, size_bytes, kind, created_at")
      .eq("user_id", userId)
      .eq("status", "ready")
      .order("created_at", { ascending: false }),
);

export const selectUserAsset = withMetrics(
  "user_assets",
  "select",
  async (client: DBClient, assetId: string, userId: string) =>
    client
      .from("user_assets")
      .select("id, key, status, size_bytes, mime_type")
      .eq("id", assetId)
      .eq("user_id", userId)
      .maybeSingle(),
);

/**
 * Writes below need the service-role client: users can only read their rows
 * (see 20261003120000_user_assets_rls_lockdown.sql). Every write is scoped by
 * user_id so the admin client can't touch another user's row by mistake.
 */
export interface ReserveUserAssetInput {
  id: string;
  userId: string;
  key: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
  quotaBytes: number;
  /** Pending rows created at or after this still reserve quota. */
  reservationCutoff: string;
}

/**
 * Checks quota and inserts the pending row atomically (per-user advisory lock
 * in reserve_user_asset), so parallel uploads can't overshoot the quota.
 * data is false when the upload doesn't fit.
 */
export const reserveUserAsset = withMetrics(
  "user_assets",
  "insert",
  async (client: DBClient, input: ReserveUserAssetInput) =>
    client.rpc("reserve_user_asset", {
      p_user_id: input.userId,
      p_id: input.id,
      p_key: input.key,
      p_file_name: input.fileName,
      p_mime_type: input.mimeType,
      p_size_bytes: input.sizeBytes,
      p_kind: input.kind,
      p_quota_bytes: input.quotaBytes,
      p_reservation_cutoff: input.reservationCutoff,
    }),
);

export const markAssetReady = withMetrics(
  "user_assets",
  "update",
  async (client: DBClient, assetId: string, userId: string, sizeBytes: number) =>
    client
      .from("user_assets")
      .update({ size_bytes: sizeBytes, status: "ready" })
      .eq("id", assetId)
      .eq("user_id", userId),
);

export const deleteUserAsset = withMetrics(
  "user_assets",
  "delete",
  async (client: DBClient, assetId: string, userId: string) =>
    client.from("user_assets").delete().eq("id", assetId).eq("user_id", userId),
);

/** Admin reconcile: pending rows abandoned before `cutoff`. */
export const selectStalePendingAssets = withMetrics(
  "user_assets",
  "select",
  async (client: DBClient, cutoff: string) =>
    client.from("user_assets").select("id, user_id, key").eq("status", "pending").lt("created_at", cutoff),
);

/**
 * Admin reconcile: one page of known object keys after `afterId`, ordered by
 * id. PostgREST caps a response at max_rows (1000), so callers must page: a
 * short list would make real files look like orphans.
 *
 * Keyset, not OFFSET: users delete rows while the sweep pages, and with OFFSET
 * every delete shifted unseen rows back past the cursor, so their files looked
 * orphaned and were deleted.
 */
export const selectAssetKeysAfter = withMetrics(
  "user_assets",
  "select",
  async (client: DBClient, afterId: string | null, limit: number) => {
    const query = client.from("user_assets").select("id, key").order("id").limit(limit);
    return afterId ? query.gt("id", afterId) : query;
  },
);

const ASSET_KEYS_PAGE_SIZE = 1000;

/** Admin reconcile: every known object key, to spot orphans in the bucket. */
export async function selectAllAssetKeys(client: DBClient): Promise<string[]> {
  const keys: string[] = [];
  let afterId: string | null = null;
  // Stop on an empty page rather than a short one, so a project with a lower
  // max_rows than the page size still gets every key.
  for (;;) {
    const { data, error } = await selectAssetKeysAfter(client, afterId, ASSET_KEYS_PAGE_SIZE);
    if (error) throw error;
    if (!data || data.length === 0) return keys;
    for (const row of data) keys.push(row.key);
    afterId = data[data.length - 1]!.id;
  }
}

/** Admin reconcile: live re-check right before an object is deleted for good. */
export async function assetKeyExists(client: DBClient, key: string): Promise<boolean> {
  const { data, error } = await client.from("user_assets").select("id").eq("key", key).limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}
