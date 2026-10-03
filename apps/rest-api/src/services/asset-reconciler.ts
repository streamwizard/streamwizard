import { reportError } from "@repo/sentry";
import type { R2ObjectInfo, R2Storage } from "@repo/storage";
import { supabase } from "@repo/supabase";
import { deleteUserAsset, selectAllAssetKeys, selectStalePendingAssets } from "@repo/supabase/queries/assets";
import { r2 } from "../lib/r2";

/**
 * Media library hygiene. Postgres can't reach R2, so this runs here:
 * - pending user_assets rows older than the reservation window are uploads
 *   that never got confirmed; drop the row and any object it left behind.
 * - objects under assets/ with no row are orphans: a deleted account (rows
 *   cascade with auth.users), or an R2 delete that failed after its row went.
 *
 * Objects newer than ORPHAN_GRACE_MS are never treated as orphans. A row is
 * always inserted before its upload URL is minted, but an upload that lands
 * between the key snapshot and the bucket listing would otherwise look
 * orphaned. After the grace window it either has a row or it's abandoned.
 */
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const FIRST_SWEEP_DELAY_MS = 30 * 1000;

/** Same window web-streamwizard uses for quota reservations. */
export const PENDING_RESERVATION_MS = 60 * 60 * 1000;
/** Upload URLs live 5 minutes; 15 leaves room for slow uploads and clock skew. */
export const ORPHAN_GRACE_MS = 15 * 60 * 1000;
const ASSET_PREFIX = "assets/";

export interface AssetReconcileResult {
  removedPending: number;
  removedOrphans: number;
}

export interface AssetReconcilerDeps {
  selectStalePending: (cutoff: string) => Promise<{ id: string; user_id: string; key: string }[]>;
  deleteRow: (id: string, userId: string) => Promise<void>;
  selectAllKeys: () => Promise<string[]>;
  listObjects: (prefix: string) => Promise<R2ObjectInfo[]>;
  deleteObject: (key: string) => Promise<void>;
  now?: () => number;
}

export function createAssetReconciler(deps: AssetReconcilerDeps) {
  const now = deps.now ?? Date.now;
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight: Promise<AssetReconcileResult> | null = null;

  async function reconcile(): Promise<AssetReconcileResult> {
    const startedAt = now();
    const cutoff = new Date(startedAt - PENDING_RESERVATION_MS).toISOString();

    const stale = await deps.selectStalePending(cutoff);
    for (const row of stale) {
      // The object may exist if the client uploaded but never confirmed.
      await deps.deleteObject(row.key).catch(() => {});
      await deps.deleteRow(row.id, row.user_id);
    }

    const known = new Set(await deps.selectAllKeys());
    const objects = await deps.listObjects(ASSET_PREFIX);
    let removedOrphans = 0;
    for (const obj of objects) {
      if (known.has(obj.key)) continue;
      const age = obj.lastModified ? startedAt - obj.lastModified.getTime() : 0;
      if (age < ORPHAN_GRACE_MS) continue;
      await deps.deleteObject(obj.key);
      removedOrphans += 1;
    }

    return { removedPending: stale.length, removedOrphans };
  }

  function sweep(): Promise<AssetReconcileResult> {
    if (inFlight) return inFlight;
    inFlight = reconcile().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  function start(): void {
    if (timer) return;
    const run = () =>
      sweep()
        .then((r) => {
          if (r.removedPending || r.removedOrphans) {
            console.log(`[asset-reconciler] removed ${r.removedPending} stale pending, ${r.removedOrphans} orphans`);
          }
        })
        .catch((error) => reportError(error, "asset-reconciler: sweep"));
    setTimeout(run, FIRST_SWEEP_DELAY_MS).unref?.();
    timer = setInterval(run, SWEEP_INTERVAL_MS);
    timer.unref?.();
  }

  function stop(): void {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { sweep, start, stop };
}

function createLiveAssetReconciler(storage: R2Storage) {
  return createAssetReconciler({
    selectStalePending: async (cutoff) => {
      const { data, error } = await selectStalePendingAssets(supabase, cutoff);
      if (error) throw error;
      return data ?? [];
    },
    deleteRow: async (id, userId) => {
      const { error } = await deleteUserAsset(supabase, id, userId);
      if (error) throw error;
    },
    selectAllKeys: () => selectAllAssetKeys(supabase),
    listObjects: (prefix) => storage.listPrefix(prefix),
    deleteObject: (key) => storage.deleteObject(key),
  });
}

/** Null (off) unless the R2 env vars are set. */
export const assetReconciler = r2 ? createLiveAssetReconciler(r2) : null;
