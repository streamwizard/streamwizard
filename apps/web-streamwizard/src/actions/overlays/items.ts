"use server";

import { revalidatePath } from "next/cache";
import { reportError } from "@repo/sentry";
import type { Database } from "@repo/supabase";
import {
  deleteOverlayItem as deleteItemRow,
  deleteOverlayItemsByIds,
  getOverlayItems,
  insertOverlayItemReturning,
  insertOverlayItems,
  insertOverlayItemsReturningIds,
  updateOverlayItemData,
  updateOverlayItemReturning,
} from "@repo/supabase/queries/overlays";
import { overlayItemSchema } from "@/schemas/overlay";
import type { OverlayItemConfig, OverlaySceneWithItems } from "@/types/overlays";
import { tryAuthContext } from "@/lib/auth";
import { getOverlayScene } from "./scenes";
import {
  OVERLAYS_ERROR_SCOPE,
  isPersistedOverlayItemId,
  overlayItemColumns,
  resolveClipFieldParentRefs,
} from "./shared";

interface OverlayItemInput {
  id?: string;
  scene_id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  design_w: number;
  design_h: number;
  crop_top: number;
  crop_right: number;
  crop_bottom: number;
  crop_left: number;
  z_index: number;
  rotation: number;
  opacity: number;
  is_visible: boolean;
  is_locked: boolean;
  label: string;
  config: OverlayItemConfig;
}

export async function saveOverlayItem(item: OverlayItemInput) {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };

  const parsed = overlayItemSchema.safeParse(item);
  if (!parsed.success) return { data: null, error: parsed.error.message };

  const columns = overlayItemColumns(parsed.data);

  const { data, error } = item.id
    ? await updateOverlayItemReturning(ctx.supabase, item.id, columns)
    : await insertOverlayItemReturning(ctx.supabase, { scene_id: parsed.data.scene_id, ...columns });

  if (error) {
    reportError(error, OVERLAYS_ERROR_SCOPE);
    return { data: null, error: error.message };
  }
  return { data, error: null };
}

export async function deleteOverlayItem(id: string) {
  const ctx = await tryAuthContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { error } = await deleteItemRow(ctx.supabase, id);
  if (error) {
    reportError(error, OVERLAYS_ERROR_SCOPE);
    return { success: false, error: error.message };
  }
  return { success: true, error: null };
}

/**
 * Persists the editor's whole item list in one go: deletes what's gone, updates
 * what stayed, inserts what's new (roots before clip-field children, so the
 * children can be re-pointed at their new parent ids).
 */
export async function saveAllOverlayItems(
  sceneId: string,
  items: Array<OverlayItemInput & { temp_id: string }>,
): Promise<{
  success: boolean;
  error: string | null;
  data: OverlaySceneWithItems | null;
}> {
  const ctx = await tryAuthContext();
  if (!ctx) return { success: false, error: "Unauthorized", data: null };
  const { supabase } = ctx;

  const idMap = new Map<string, string>();
  const existingItems = items.filter((i) => isPersistedOverlayItemId(i.id));
  const newItems = items.filter((i) => !isPersistedOverlayItemId(i.id));
  const keepIds = existingItems.map((i) => i.id!);

  const { data: dbItems } = await getOverlayItems(supabase, sceneId);

  const idsToDelete = (dbItems ?? []).map((row) => row.id).filter((id) => !keepIds.includes(id));

  if (idsToDelete.length > 0) {
    const { error: delErr } = await deleteOverlayItemsByIds(supabase, idsToDelete);
    if (delErr) {
      reportError(delErr, OVERLAYS_ERROR_SCOPE);
      return { success: false, error: delErr.message, data: null };
    }
  }

  for (const item of existingItems) {
    const parsed = overlayItemSchema.safeParse({
      ...item,
      id: item.id,
      config: resolveClipFieldParentRefs(item.config, idMap),
    });
    if (!parsed.success) {
      return { success: false, error: parsed.error.message, data: null };
    }
    const { error } = await updateOverlayItemData(supabase, item.id!, overlayItemColumns(parsed.data));
    if (error) {
      reportError(error, OVERLAYS_ERROR_SCOPE);
      return { success: false, error: error.message, data: null };
    }
  }

  type ItemInsert = Database["public"]["Tables"]["overlay_items"]["Insert"];

  /** Validates each item and maps it to an insert row, or returns the first error. */
  function buildInsertPayloads(
    batch: Array<OverlayItemInput & { temp_id: string }>,
    config: (item: OverlayItemInput) => OverlayItemConfig,
  ): { rows: ItemInsert[]; error?: string } {
    const rows: ItemInsert[] = [];
    for (const item of batch) {
      const parsed = overlayItemSchema.safeParse({ ...item, id: undefined, config: config(item) });
      if (!parsed.success) return { rows: [], error: parsed.error.message };
      rows.push({ scene_id: sceneId, ...overlayItemColumns(parsed.data) });
    }
    return { rows };
  }

  const newRoots = newItems.filter((i) => i.type !== "clip_display_field");
  const newChildren = newItems.filter((i) => i.type === "clip_display_field");

  if (newRoots.length > 0) {
    const { rows, error: buildErr } = buildInsertPayloads(newRoots, (item) => item.config);
    if (buildErr) return { success: false, error: buildErr, data: null };

    const { data: insertedRoots, error: insErr } = await insertOverlayItemsReturningIds(supabase, rows);

    if (insErr) {
      reportError(insErr, OVERLAYS_ERROR_SCOPE);
      return { success: false, error: insErr.message, data: null };
    }
    if (!insertedRoots || insertedRoots.length !== newRoots.length) {
      return { success: false, error: "Failed to assign new item ids", data: null };
    }

    newRoots.forEach((item, idx) => {
      const row = insertedRoots[idx];
      if (row?.id) idMap.set(item.temp_id, row.id);
    });
  }

  if (newChildren.length > 0) {
    const { rows, error: buildErr } = buildInsertPayloads(newChildren, (item) =>
      resolveClipFieldParentRefs(item.config, idMap),
    );
    if (buildErr) return { success: false, error: buildErr, data: null };

    const { error: chErr } = await insertOverlayItems(supabase, rows);
    if (chErr) {
      reportError(chErr, OVERLAYS_ERROR_SCOPE);
      return { success: false, error: chErr.message, data: null };
    }
  }

  revalidatePath("/dashboard/overlays");

  const reloaded = await getOverlayScene(sceneId);
  // getOverlayScene already reports its own DB errors; this reload is
  // best-effort, so the save still returns success without the fresh data.
  if (reloaded.error || !reloaded.data) {
    return { success: true, error: null, data: null };
  }
  return { success: true, error: null, data: reloaded.data };
}
