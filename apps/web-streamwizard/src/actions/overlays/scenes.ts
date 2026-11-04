"use server";

import { randomBytes, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { reportError } from "@repo/sentry";
import { toActionError, zodErrorMessage } from "@/lib/action-error";
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
  updateSceneUrlCredentials,
} from "@repo/supabase/queries/overlays";
import { updateSceneSchema } from "@/schemas/overlay";
import { createSceneInputSchema } from "@/schemas/overlay-actions";
import { idSchema } from "@/schemas/ids";
import type { ClipDisplayFieldItemConfig } from "@/types/overlays";
import { overlayItemFromDbRow } from "@/types/overlays";
import { createAdminClient } from "@repo/supabase/next/admin";
import { tryAuthContext } from "@/lib/auth";
import { isLegacySlug } from "@/lib/overlay-slug";
import { revokeWsSockets } from "@/lib/ws-revoke";
import { sanitizeGroups } from "@/components/overlays/editor/item-groups";
import { OVERLAYS_ERROR_SCOPE, generateSlug } from "./shared";

export async function getOverlayScenes() {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };

  const { data, error } = await getSceneRows(ctx.supabase, ctx.user.id);
  if (error) {
    return { data: null, error: toActionError(error, OVERLAYS_ERROR_SCOPE, "Couldn't load your overlays. Try again?") };
  }
  return { data, error: null };
}

export async function getOverlayScene(id: string) {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { data: null, error: "Not found" };

  const { scene, items, groups, error } = await getSceneWithItems(ctx.supabase, parsedId.data, ctx.user.id);
  if (error) {
    return { data: null, error: toActionError(error, OVERLAYS_ERROR_SCOPE, "Couldn't load this overlay. Try again?") };
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

  const parsed = createSceneInputSchema.safeParse(formData);
  if (!parsed.success) return { data: null, error: zodErrorMessage(parsed.error, "Check the overlay name and size.") };
  const renderMode = parsed.data.render_mode ?? "obs";

  const { data, error } = await createSceneRow(ctx.supabase, {
    user_id: ctx.user.id,
    name: parsed.data.name,
    slug: generateSlug(parsed.data.name),
    width: parsed.data.width ?? 1920,
    height: parsed.data.height ?? 1080,
    render_mode: renderMode,
    is_active: true,
  });

  if (error) {
    return { data: null, error: toActionError(error, OVERLAYS_ERROR_SCOPE, "Couldn't create the overlay. Try again?") };
  }

  await track(
    "overlay_created",
    { overlay_id: data.id, template: "blank", render_mode: renderMode },
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
  if (!parsed.success) return { data: null, error: zodErrorMessage(parsed.error, "Check the overlay settings.") };

  const { id, ...updates } = parsed.data;

  const { data, error } = await updateSceneRow(ctx.supabase, id, ctx.user.id, updates);
  if (error) {
    return { data: null, error: toActionError(error, OVERLAYS_ERROR_SCOPE, "Couldn't save the overlay. Try again?") };
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

export async function deleteOverlayScene(sceneId: string) {
  const ctx = await tryAuthContext();
  if (!ctx) return { success: false, error: "Unauthorized" };
  const parsedId = idSchema.safeParse(sceneId);
  if (!parsedId.success) return { success: false, error: "Not found" };
  const id = parsedId.data;

  const { error } = await deleteSceneRow(ctx.supabase, id, ctx.user.id);
  if (error) {
    return { success: false, error: toActionError(error, OVERLAYS_ERROR_SCOPE, "Couldn't delete the overlay. Try again?") };
  }

  // Overlays still open with this scene's key lose their socket now.
  await revokeWsSockets(ctx.user.id, "scene");
  await track("overlay_deleted", { overlay_id: id }, ctx.user);

  revalidatePath("/dashboard/overlays");
  return { success: true, error: null };
}

export async function duplicateOverlayScene(sceneId: string) {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  const { supabase, user } = ctx;
  const parsedId = idSchema.safeParse(sceneId);
  if (!parsedId.success) return { data: null, error: "Not found" };
  const id = parsedId.data;

  const { data: original, error: fetchError } = await getOverlaySceneRow(supabase, id, user.id);

  if (fetchError) return { data: null, error: toActionError(fetchError, OVERLAYS_ERROR_SCOPE, "Couldn't duplicate the overlay. Try again?") };
  if (!original) return { data: null, error: "Not found" };

  const { data: newScene, error: createError } = await createSceneRow(supabase, {
    user_id: user.id,
    name: original.name + " (Copy)",
    slug: generateSlug(original.name + " copy"),
    width: original.width,
    height: original.height,
  });

  if (createError) return { data: null, error: toActionError(createError, OVERLAYS_ERROR_SCOPE, "Couldn't duplicate the overlay. Try again?") };
  if (!newScene) return { data: null, error: "Couldn't duplicate the overlay. Try again?" };

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
      return { data: null, error: toActionError(groupErr, OVERLAYS_ERROR_SCOPE, "Couldn't duplicate the overlay. Try again?") };
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

    if (rootErr) return { data: null, error: toActionError(rootErr, OVERLAYS_ERROR_SCOPE, "Couldn't duplicate the overlay. Try again?") };
    if (!insertedRoots) return { data: null, error: "Couldn't duplicate the overlay. Try again?" };

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
          return { data: null, error: toActionError(childErr, OVERLAYS_ERROR_SCOPE, "Couldn't duplicate the overlay. Try again?") };
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

/**
 * New URL and new subscriber token together. The URL is what hands out the
 * token, so changing only the token would leave anyone with the old URL able
 * to fetch the new one. Both columns are service-role only, so the write goes
 * through the admin client after the owner check.
 */
export async function resetSceneUrl(rawSceneId: string): Promise<{ data: { slug: string } | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  const parsedId = idSchema.safeParse(rawSceneId);
  if (!parsedId.success) return { data: null, error: "Not found" };
  const sceneId = parsedId.data;

  const { data: scene, error: fetchError } = await getOverlaySceneRow(ctx.supabase, sceneId, ctx.user.id);
  if (fetchError) return { data: null, error: toActionError(fetchError, OVERLAYS_ERROR_SCOPE, "Couldn't reset the overlay URL.") };
  if (!scene) return { data: null, error: "Not found" };

  const { data, error } = await updateSceneUrlCredentials(createAdminClient(), sceneId, ctx.user.id, {
    slug: generateSlug(scene.name),
    subscriber_token: randomBytes(32).toString("hex"),
  });

  revalidatePath("/dashboard/overlays");
  if (error || !data) {
    if (error) return { data: null, error: toActionError(error, OVERLAYS_ERROR_SCOPE, "Couldn't reset the overlay URL.") };
    return { data: null, error: "Couldn't reset the overlay URL." };
  }

  // Sockets opened with the old token close now, not at the next sweep.
  await revokeWsSockets(ctx.user.id, "scene");
  await track("overlay_url_reset", { overlay_id: sceneId, legacy_slug: isLegacySlug(scene.slug) }, ctx.user);
  return { data: { slug: data.slug }, error: null };
}
