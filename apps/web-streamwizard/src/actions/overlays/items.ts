"use server";

import { revalidatePath } from "next/cache";
import { reportError } from "@repo/sentry";
import type { Database } from "@repo/supabase";
import {
  deleteOverlayItemGroupsByIds,
  deleteOverlayItemsByIds,
  getOverlayItemGroups,
  getOverlayItems,
  getOverlaySceneRow,
  insertOverlayItemsReturningRows,
  upsertOverlayItemGroups,
  upsertOverlayItemsReturningRows,
} from "@repo/supabase/queries/overlays";
import { overlayItemSchema } from "@/schemas/overlay";
import { saveOverlayItemsSchema } from "@/schemas/overlay-actions";
import {
  overlayItemFromDbRow,
  type OverlayItem,
  type OverlayItemConfig,
  type OverlayItemGroup,
  type OverlaySceneWithItems,
} from "@/types/overlays";
import { sanitizeGroups } from "@/components/overlays/editor/item-groups";
import { tryAuthContext } from "@/lib/auth";
import { track } from "@/lib/track";
import { mergeSavedItemRows, overlayItemRowChanged } from "./save-batch";
import { diffOverlaySave, type StoredOverlayItem, type WidgetRef } from "./save-diff";
import { getOverlayScene } from "./scenes";
import {
  OVERLAYS_ERROR_SCOPE,
  isPersistedOverlayItemId,
  overlayItemColumns,
  resolveClipFieldParentRefs,
} from "./shared";

const SAVE_FAILED = "This overlay couldn't be saved. Reload the editor and try again.";

// A save that swaps out a whole overlay is still one save, not 200 events.
const MAX_WIDGET_EVENTS_PER_SAVE = 40;

interface OverlayItemInput {
  id?: string;
  scene_id: string;
  type: string;
  x: number;
  y: number;
  anchor_x: OverlayItem["anchor_x"];
  anchor_y: OverlayItem["anchor_y"];
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
  flip_h: boolean;
  flip_v: boolean;
  opacity: number;
  is_visible: boolean;
  is_locked: boolean;
  label: string;
  config: OverlayItemConfig;
  group_id?: string | null;
}

/**
 * Persists the editor's whole item list in one go: deletes what's gone, writes
 * the items that changed in one upsert, inserts what's new (roots before
 * clip-field children, so the children can be re-pointed at their new parent
 * ids). The saved scene is put together from the rows the writes return, so a
 * save doesn't read the whole scene back.
 *
 * Groups go around that: written before the items (the items point at them)
 * and the stale ones deleted after (nothing points at them any more). Group
 * ids come from the editor, so they need no remap.
 */
export async function saveAllOverlayItems(
  rawSceneId: string,
  itemsInput: Array<OverlayItemInput & { temp_id: string }>,
  groupsInput: OverlayItemGroup[] = [],
): Promise<{
  success: boolean;
  error: string | null;
  data: OverlaySceneWithItems | null;
  /** temp-N id -> the DB id it was inserted as, so the editor can keep its selection. */
  idMap: Record<string, string>;
}> {
  const ctx = await tryAuthContext();
  if (!ctx) return { success: false, error: "Unauthorized", data: null, idMap: {} };
  const { supabase } = ctx;

  const input = saveOverlayItemsSchema.safeParse({ sceneId: rawSceneId, items: itemsInput, groups: groupsInput });
  if (!input.success) {
    return { success: false, error: SAVE_FAILED, data: null, idMap: {} };
  }
  const sceneId = input.data.sceneId;
  // Each item is validated against overlayItemSchema below, before it's written.
  const rawItems = input.data.items as unknown as typeof itemsInput;
  const rawGroups = input.data.groups;

  // RLS on overlay_items limits writes to the owner's scenes too; checking
  // here turns someone else's scene into a clear error before any delete.
  // The three reads don't depend on each other, so they go out together.
  const [{ data: ownedScene }, { data: dbItemRows, error: itemsFetchErr }, { data: dbGroups, error: groupsFetchErr }] =
    await Promise.all([
      getOverlaySceneRow(supabase, sceneId, ctx.user.id),
      getOverlayItems(supabase, sceneId),
      getOverlayItemGroups(supabase, sceneId),
    ]);
  if (!ownedScene) return { success: false, error: "Not found", data: null, idMap: {} };
  // Without the stored rows every item would look new and be inserted twice.
  if (itemsFetchErr) {
    reportError(itemsFetchErr, OVERLAYS_ERROR_SCOPE);
    return { success: false, error: SAVE_FAILED, data: null, idMap: {} };
  }
  const dbItems = dbItemRows ?? [];

  // Only the group tree is cleaned here (dangling refs, cycles, empty groups);
  // each item is still validated on its own below.
  const sanitized = sanitizeGroups(
    rawItems as unknown as OverlayItem[],
    rawGroups.map((g) => ({ ...g, scene_id: sceneId, label: g.label.trim() })),
  );
  const items = sanitized.items as unknown as typeof rawItems;
  const groups = sanitized.groups;

  const idMap = new Map<string, string>();
  // Existing rows as this save wrote them, for the "what changed" event.
  const written: StoredOverlayItem[] = [];
  const storedById = new Map(dbItems.map((row) => [row.id, row]));

  // Undo can bring back an item a previous save already deleted: it still
  // carries its old DB id, but no row answers to it any more. Updating that id
  // would match zero rows and drop the item without an error, so anything the
  // table no longer holds is re-inserted and reported back through idMap.
  const isLive = (i: (typeof items)[number]) =>
    isPersistedOverlayItemId(i.id) && storedById.has(i.id!);
  const existingItems = items.filter(isLive);
  const newItems = items.filter((i) => !isLive(i));
  const keepIds = new Set(existingItems.map((i) => i.id!));

  const idsToDelete = dbItems.map((row) => row.id).filter((id) => !keepIds.has(id));

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

  // Everything that can be checked before the first write is checked here, so
  // a bad item fails the save before anything has changed.
  const changedRows: Array<ItemInsert & { id: string }> = [];
  for (const item of existingItems) {
    const parsed = overlayItemSchema.safeParse({
      ...item,
      id: item.id,
      config: resolveClipFieldParentRefs(item.config, idMap),
    });
    if (!parsed.success) {
      return { success: false, error: parsed.error.message, data: null, idMap: {} };
    }
    const columns = overlayItemColumns(parsed.data);
    const row = { id: item.id!, scene_id: sceneId, ...columns };
    // An item nobody touched since the last save costs no write.
    if (overlayItemRowChanged(storedById.get(item.id!), row)) changedRows.push(row);
    written.push({ id: item.id!, type: item.type, config: columns.config });
  }

  const newRoots = newItems.filter((i) => i.type !== "clip_display_field");
  const newChildren = newItems.filter((i) => i.type === "clip_display_field");
  const rootPayloads = buildInsertPayloads(newRoots, (item) => item.config);
  if (rootPayloads.error) return { success: false, error: rootPayloads.error, data: null, idMap: {} };

  // Groups go first (items point at them); deletes don't depend on them.
  const [groupRes, delRes] = await Promise.all([
    groups.length > 0
      ? upsertOverlayItemGroups(
          supabase,
          groups.map(({ id, parent_group_id, label }) => ({ id, scene_id: sceneId, parent_group_id, label })),
        )
      : null,
    idsToDelete.length > 0 ? deleteOverlayItemsByIds(supabase, idsToDelete) : null,
  ]);
  const firstWriteErr = groupRes?.error ?? delRes?.error;
  if (firstWriteErr) {
    reportError(firstWriteErr, OVERLAYS_ERROR_SCOPE);
    return { success: false, error: firstWriteErr.message, data: null, idMap: {} };
  }

  // Changed items in one upsert, new root items in one insert, side by side.
  const [updateRes, rootRes] = await Promise.all([
    changedRows.length > 0 ? upsertOverlayItemsReturningRows(supabase, changedRows) : null,
    rootPayloads.rows.length > 0 ? insertOverlayItemsReturningRows(supabase, rootPayloads.rows) : null,
  ]);
  const itemWriteErr = updateRes?.error ?? rootRes?.error;
  if (itemWriteErr) {
    reportError(itemWriteErr, OVERLAYS_ERROR_SCOPE);
    return { success: false, error: itemWriteErr.message, data: null, idMap: {} };
  }
  const insertedRoots = rootRes?.data ?? [];
  if (insertedRoots.length !== newRoots.length) {
    return { success: false, error: "Failed to assign new item ids", data: null, idMap: {} };
  }
  newRoots.forEach((item, idx) => {
    const row = insertedRoots[idx];
    if (row?.id) idMap.set(item.temp_id, row.id);
  });

  let insertedChildren: typeof insertedRoots = [];
  if (newChildren.length > 0) {
    const { rows, error: buildErr } = buildInsertPayloads(newChildren, (item) =>
      resolveClipFieldParentRefs(item.config, idMap),
    );
    if (buildErr) return { success: false, error: buildErr, data: null, idMap: {} };

    const { data, error: chErr } = await insertOverlayItemsReturningRows(supabase, rows);
    if (chErr) {
      reportError(chErr, OVERLAYS_ERROR_SCOPE);
      return { success: false, error: chErr.message, data: null, idMap: {} };
    }
    insertedChildren = data ?? [];
    newChildren.forEach((item, idx) => {
      const row = insertedChildren[idx];
      if (row?.id) idMap.set(item.temp_id, row.id);
    });
  }

  // Last, so no item still points at a group being removed. The group list
  // was read before the save; the upsert above only wrote groups being kept,
  // so the stale ones are the same either way.
  if (groupsFetchErr) {
    reportError(groupsFetchErr, OVERLAYS_ERROR_SCOPE);
  } else {
    const keepGroupIds = new Set(groups.map((g) => g.id));
    const staleGroupIds = (dbGroups ?? []).map((g) => g.id).filter((id) => !keepGroupIds.has(id));
    if (staleGroupIds.length > 0) {
      const { error: groupDelErr } = await deleteOverlayItemGroupsByIds(supabase, sceneId, staleGroupIds);
      // A leftover empty group is harmless (the editor prunes it on load), so
      // this doesn't fail a save that has already written every item.
      if (groupDelErr) reportError(groupDelErr, OVERLAYS_ERROR_SCOPE);
    }
  }

  revalidatePath("/dashboard/overlays");

  // Everything is saved at this point. Whatever goes wrong while describing
  // the save must not turn it into a failed one.
  try {
    // A stored config predates whatever defaults the schema has gained since
    // it was written. Compared as stored, every widget of a type would count
    // as changed the first time it is saved after such a release, so the old
    // side goes through the same schema as the new one first.
    const stored = dbItems.map((row): StoredOverlayItem => {
      const parsed = overlayItemSchema.safeParse(overlayItemFromDbRow(row));
      return { id: row.id, type: row.type, config: parsed.success ? overlayItemColumns(parsed.data).config : row.config };
    });
    const diff = diffOverlaySave({
      stored,
      deletedIds: idsToDelete,
      updated: written,
      inserted: newItems,
    });
    const types = (refs: WidgetRef[]) => [...new Set(refs.map((ref) => ref.type))].sort();
    await track(
      "overlay_saved",
      {
        overlay_id: sceneId,
        item_count: diff.itemCount,
        added_types: types(diff.added),
        added_count: diff.added.length,
        removed_types: types(diff.removed),
        removed_count: diff.removed.length,
        reconfigured_types: diff.reconfiguredTypes,
        reconfigured_count: diff.reconfiguredCount,
      },
      ctx.user,
    );
    // One event per widget as well: PostHog cannot break a chart down by the
    // entries of a list, and "which widgets get added" is the chart.
    const widgetEvent = (ref: WidgetRef) => ({
      overlay_id: sceneId,
      widget: ref.type,
      custom: ref.type === "custom_widget",
      ...(ref.customWidgetId ? { custom_widget_id: ref.customWidgetId } : {}),
    });
    for (const ref of diff.added.slice(0, MAX_WIDGET_EVENTS_PER_SAVE)) {
      await track("widget_added", widgetEvent(ref), ctx.user);
    }
    for (const ref of diff.removed.slice(0, MAX_WIDGET_EVENTS_PER_SAVE)) {
      await track("widget_removed", widgetEvent(ref), ctx.user);
    }
  } catch (error) {
    reportError(error, "overlays: save diff");
  }

  const updatedRows = updateRes?.data ?? [];
  const writtenRows = [...updatedRows, ...insertedRoots, ...insertedChildren];
  // Every write answered with its row, so the scene can be put together here
  // instead of read back. If one didn't (a row the editor never saw), read it.
  if (updatedRows.length !== changedRows.length || insertedChildren.length !== newChildren.length) {
    const reloaded = await getOverlayScene(sceneId);
    // getOverlayScene already reports its own DB errors; this reload is
    // best-effort, so the save still returns success without the fresh data.
    return { success: true, error: null, data: reloaded.data ?? null, idMap: Object.fromEntries(idMap) };
  }
  const savedRows = mergeSavedItemRows(dbItems, idsToDelete, writtenRows);
  return {
    success: true,
    error: null,
    data: {
      ...ownedScene,
      items: savedRows.map((row) => overlayItemFromDbRow(row)),
      groups: groups.map(({ id, parent_group_id, label }) => ({ id, scene_id: sceneId, parent_group_id, label })),
    },
    idMap: Object.fromEntries(idMap),
  };
}
