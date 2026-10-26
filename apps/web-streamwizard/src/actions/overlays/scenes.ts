"use server";

import { randomBytes, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { reportError } from "@repo/sentry";
import { track } from "@/lib/track";
import type { Json } from "@repo/supabase";
import {
  createOverlayScene as createSceneRow,
  deleteOverlayScene as deleteSceneRow,
  getAllOverlayItemsByScene,
  getOverlayItemGroups,
  insertOverlayItemGroups,
  getOverlayScene as getSceneWithItems,
  getOverlaySceneRow,
  getOverlayScenes as getSceneRows,
  insertOverlayItems,
  insertOverlayItemsReturningIds,
  updateOverlayScene as updateSceneRow,
  updateSceneSubscriberToken,
} from "@repo/supabase/queries/overlays";
import { createSceneSchema, updateSceneSchema } from "@/schemas/overlay";
import type { ClipDisplayFieldItemConfig } from "@/types/overlays";
import { overlayItemFromDbRow } from "@/types/overlays";
import { tryAuthContext } from "@/lib/auth";
import { sanitizeGroups } from "@/components/overlays/editor/item-groups";
import { OVERLAYS_ERROR_SCOPE, generateSlug } from "./shared";

export async function getOverlayScenes() {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };

  const { data, error } = await getSceneRows(ctx.supabase, ctx.user.id);
  if (error) {
    reportError(error, OVERLAYS_ERROR_SCOPE);
    return { data: null, error: error.message };
  }
  return { data, error: null };
}

export async function getOverlayScene(id: string) {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };

  const { scene, items, groups, error } = await getSceneWithItems(ctx.supabase, id, ctx.user.id);
  if (error) {
    reportError(error, OVERLAYS_ERROR_SCOPE);
    return { data: null, error: error.message };
  }

  return {
    data: {
      ...scene,
      items: (items ?? []).map((item) => overlayItemFromDbRow(item)),
      groups: (groups ?? []).map(({ id, scene_id, parent_group_id, label }) => ({
        id,
        scene_id,
        parent_group_id,
        label,
      })),
    },
    error: null,
  };
}

export async function createOverlayScene(formData: {
  name: string;
  width?: number;
  height?: number;
  render_mode?: "obs" | "gps";
}) {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };

  const parsed = createSceneSchema.safeParse(formData);
  if (!parsed.success) return { data: null, error: parsed.error.message };

  const { data, error } = await createSceneRow(ctx.supabase, {
    user_id: ctx.user.id,
    name: parsed.data.name,
    slug: generateSlug(parsed.data.name),
    width: parsed.data.width ?? 1920,
    height: parsed.data.height ?? 1080,
    render_mode: formData.render_mode ?? "obs",
    is_active: true,
  });

  if (error) {
    reportError(error, OVERLAYS_ERROR_SCOPE);
    return { data: null, error: error.message };
  }

  await track(
    "overlay_created",
    { overlay_id: data.id, template: "blank", render_mode: formData.render_mode ?? "obs" },
    ctx.user,
  );
  revalidatePath("/dashboard/overlays");
  return { data, error: null };
}

export async function updateOverlayScene(formData: {
  id: string;
  name?: string;
  width?: number;
  height?: number;
  is_active?: boolean;
  is_favourite?: boolean;
}) {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };

  const parsed = updateSceneSchema.safeParse(formData);
  if (!parsed.success) return { data: null, error: parsed.error.message };

  const { id, ...updates } = parsed.data;

  const { data, error } = await updateSceneRow(ctx.supabase, id, ctx.user.id, updates);
  if (error) {
    reportError(error, OVERLAYS_ERROR_SCOPE);
    return { data: null, error: error.message };
  }

  // The same action saves the canvas size from the editor; only the two list
  // toggles are events.
  if (updates.is_favourite !== undefined) {
    await track("overlay_favourite_toggled", { overlay_id: id, favourite: updates.is_favourite }, ctx.user);
  }
  if (updates.is_active !== undefined) {
    await track("overlay_active_toggled", { overlay_id: id, active: updates.is_active }, ctx.user);
  }

  revalidatePath("/dashboard/overlays");
  return { data, error: null };
}

export async function deleteOverlayScene(id: string) {
  const ctx = await tryAuthContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { error } = await deleteSceneRow(ctx.supabase, id, ctx.user.id);
  if (error) {
    reportError(error, OVERLAYS_ERROR_SCOPE);
    return { success: false, error: error.message };
  }

  await track("overlay_deleted", { overlay_id: id }, ctx.user);

  revalidatePath("/dashboard/overlays");
  return { success: true, error: null };
}

export async function duplicateOverlayScene(id: string) {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  const { supabase, user } = ctx;

  const { data: original, error: fetchError } = await getOverlaySceneRow(supabase, id, user.id);

  if (fetchError) reportError(fetchError, OVERLAYS_ERROR_SCOPE);
  if (fetchError || !original) return { data: null, error: fetchError?.message ?? "Not found" };

  const { data: newScene, error: createError } = await createSceneRow(supabase, {
    user_id: user.id,
    name: original.name + " (Copy)",
    slug: generateSlug(original.name + " copy"),
    width: original.width,
    height: original.height,
  });

  if (createError) reportError(createError, OVERLAYS_ERROR_SCOPE);
  if (createError || !newScene) return { data: null, error: createError?.message ?? "Failed to create" };

  const { data: originalItems, error: itemsFetchErr } = await getAllOverlayItemsByScene(supabase, id);
  // Items failing to load means the duplicate is created empty — report it,
  // the user has no way to tell this apart from a scene that had no items.
  if (itemsFetchErr) reportError(itemsFetchErr, OVERLAYS_ERROR_SCOPE);

  // Groups first: the copied items point at them. Fresh ids, same tree, and
  // sanitizeGroups hands them back parents first so each parent row exists.
  const { data: originalGroups, error: groupsFetchErr } = await getOverlayItemGroups(supabase, id);
  if (groupsFetchErr) reportError(groupsFetchErr, OVERLAYS_ERROR_SCOPE);
  const { groups: groupsToCopy } = sanitizeGroups(
    (originalItems ?? []).map((row) => overlayItemFromDbRow(row)),
    originalGroups ?? [],
  );
  const groupIdMap = new Map(groupsToCopy.map((g) => [g.id, randomUUID()]));
  if (groupsToCopy.length > 0) {
    const { error: groupErr } = await insertOverlayItemGroups(
      supabase,
      groupsToCopy.map((g) => ({
        id: groupIdMap.get(g.id)!,
        scene_id: newScene.id,
        parent_group_id: g.parent_group_id ? (groupIdMap.get(g.parent_group_id) ?? null) : null,
        label: g.label,
      })),
    );
    if (groupErr) {
      reportError(groupErr, OVERLAYS_ERROR_SCOPE);
      return { data: null, error: groupErr.message };
    }
  }
  const copyGroupId = (groupId: string | null) =>
    groupId ? (groupIdMap.get(groupId) ?? null) : null;

  if (originalItems?.length) {
    const roots = originalItems.filter((row) => row.type !== "clip_display_field");
    const children = originalItems.filter((row) => row.type === "clip_display_field");
    const oldIdToNew = new Map<string, string>();

    const { data: insertedRoots, error: rootErr } = await insertOverlayItemsReturningIds(
      supabase,
      roots.map(({ id: _i, created_at: _c, updated_at: _u, scene_id: _s, group_id, ...rest }) => ({
        ...rest,
        scene_id: newScene.id,
        group_id: copyGroupId(group_id),
      })),
    );

    if (rootErr) reportError(rootErr, OVERLAYS_ERROR_SCOPE);
    if (rootErr || !insertedRoots) {
      return { data: null, error: rootErr?.message ?? "Failed to copy items" };
    }

    roots.forEach((row, idx) => {
      oldIdToNew.set(row.id, insertedRoots[idx]!.id);
    });

    if (children.length > 0) {
      const childRows = children
        .map(({ id: _i, created_at: _c, updated_at: _u, scene_id: _s, group_id: _g, config, ...rest }) => {
          const cfg = config as unknown as ClipDisplayFieldItemConfig;
          const newParentId = oldIdToNew.get(cfg.parentClipItemId);
          if (!newParentId) return null;
          return {
            ...rest,
            scene_id: newScene.id,
            config: { ...cfg, parentClipItemId: newParentId } as unknown as Json,
          };
        })
        .filter((row) => row !== null);

      if (childRows.length > 0) {
        const { error: childErr } = await insertOverlayItems(supabase, childRows);
        if (childErr) {
          reportError(childErr, OVERLAYS_ERROR_SCOPE);
          return { data: null, error: childErr.message };
        }
      }
    }
  }

  await track(
    "overlay_duplicated",
    {
      overlay_id: newScene.id,
      source_overlay_id: id,
      item_count: originalItems?.filter((row) => row.type !== "clip_display_field").length ?? 0,
    },
    user,
  );
  revalidatePath("/dashboard/overlays");
  return { data: newScene, error: null };
}

export async function resetSceneSubscriberToken(sceneId: string): Promise<{ error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { error: "Unauthorized" };

  const newToken = randomBytes(32).toString("hex");
  const { error } = await updateSceneSubscriberToken(ctx.supabase, sceneId, ctx.user.id, newToken);

  revalidatePath("/dashboard/overlays");
  if (error) reportError(error, OVERLAYS_ERROR_SCOPE);
  else await track("overlay_key_reset", { overlay_id: sceneId }, ctx.user);
  return { error: error?.message ?? null };
}
