"use server";

import {
  createSceneSchema,
  overlayItemSchema,
  updateSceneSchema,
} from "@/schemas/overlay";
import type {
  ClipDisplayFieldItemConfig,
  OverlayItem,
  OverlayItemConfig,
  OverlaySceneWithItems,
} from "@/types/overlays";
import { overlayItemFromDbRow } from "@/types/overlays";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/supabase";
import { revalidatePath } from "next/cache";

function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    Math.random().toString(36).substring(2, 8)
  );
}

function isPersistedOverlayItemId(id: string | undefined): boolean {
  return (
    !!id &&
    !id.startsWith("temp-") &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  );
}

export async function getOverlayScenes() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return { data: null, error: "Unauthorized" };

  const { data, error } = await supabase
    .from("overlay_scenes")
    .select("*")
    .eq("user_id", user.user.id)
    .order("updated_at", { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function getOverlayScene(id: string) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return { data: null, error: "Unauthorized" };

  const { data: scene, error: sceneError } = await supabase
    .from("overlay_scenes")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.user.id)
    .single();

  if (sceneError) return { data: null, error: sceneError.message };

  const { data: items, error: itemsError } = await supabase
    .from("overlay_items")
    .select("*")
    .eq("scene_id", id)
    .order("z_index", { ascending: true });

  if (itemsError) return { data: null, error: itemsError.message };

  return {
    data: {
      ...scene,
      items: (items ?? []).map((item) => overlayItemFromDbRow(item)),
    },
    error: null,
  };
}

export async function createOverlayScene(formData: {
  name: string;
  width?: number;
  height?: number;
}) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return { data: null, error: "Unauthorized" };

  const parsed = createSceneSchema.safeParse(formData);
  if (!parsed.success) return { data: null, error: parsed.error.message };

  const slug = generateSlug(parsed.data.name);

  const { data, error } = await supabase
    .from("overlay_scenes")
    .insert({
      user_id: user.user.id,
      name: parsed.data.name,
      slug,
      width: parsed.data.width ?? 1920,
      height: parsed.data.height ?? 1080,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath("/dashboard/overlays");
  return { data, error: null };
}

export async function updateOverlayScene(formData: {
  id: string;
  name?: string;
  width?: number;
  height?: number;
  is_active?: boolean;
}) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return { data: null, error: "Unauthorized" };

  const parsed = updateSceneSchema.safeParse(formData);
  if (!parsed.success) return { data: null, error: parsed.error.message };

  const { id, ...updates } = parsed.data;

  const { data, error } = await supabase
    .from("overlay_scenes")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.user.id)
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  revalidatePath("/dashboard/overlays");
  return { data, error: null };
}

export async function deleteOverlayScene(id: string) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("overlay_scenes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/overlays");
  return { success: true, error: null };
}

export async function duplicateOverlayScene(id: string) {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return { data: null, error: "Unauthorized" };

  const { data: original, error: fetchError } = await supabase
    .from("overlay_scenes")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.user.id)
    .single();

  if (fetchError || !original)
    return { data: null, error: fetchError?.message ?? "Not found" };

  const slug = generateSlug(original.name + " copy");

  const { data: newScene, error: createError } = await supabase
    .from("overlay_scenes")
    .insert({
      user_id: user.user.id,
      name: original.name + " (Copy)",
      slug,
      width: original.width,
      height: original.height,
    })
    .select()
    .single();

  if (createError || !newScene)
    return { data: null, error: createError?.message ?? "Failed to create" };

  const { data: originalItems } = await supabase
    .from("overlay_items")
    .select("*")
    .eq("scene_id", id);

  if (originalItems?.length) {
    const roots = originalItems.filter((row) => row.type !== "clip_display_field");
    const children = originalItems.filter((row) => row.type === "clip_display_field");
    const oldIdToNew = new Map<string, string>();

    const { data: insertedRoots, error: rootErr } = await supabase
      .from("overlay_items")
      .insert(
        roots.map(({ id: _i, created_at: _c, updated_at: _u, scene_id: _s, ...rest }) => ({
          ...rest,
          scene_id: newScene.id,
        }))
      )
      .select("id");

    if (rootErr || !insertedRoots) {
      return { data: null, error: rootErr?.message ?? "Failed to copy items" };
    }

    roots.forEach((row, idx) => {
      oldIdToNew.set(row.id, insertedRoots[idx]!.id);
    });

    if (children.length > 0) {
      const childRows = children
        .map(({ id: _i, created_at: _c, updated_at: _u, scene_id: _s, config, ...rest }) => {
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
        const { error: childErr } = await supabase.from("overlay_items").insert(childRows);
        if (childErr) return { data: null, error: childErr.message };
      }
    }
  }

  revalidatePath("/dashboard/overlays");
  return { data: newScene, error: null };
}

export async function saveOverlayItem(item: {
  id?: string;
  scene_id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z_index: number;
  rotation: number;
  opacity: number;
  is_visible: boolean;
  is_locked: boolean;
  label: string;
  config: OverlayItemConfig;
}) {
  const supabase = await createClient();
  const parsed = overlayItemSchema.safeParse(item);
  if (!parsed.success) return { data: null, error: parsed.error.message };

  if (item.id) {
    const { data, error } = await supabase
      .from("overlay_items")
      .update({
        type: parsed.data.type,
        x: parsed.data.x,
        y: parsed.data.y,
        w: parsed.data.w,
        h: parsed.data.h,
        z_index: parsed.data.z_index,
        rotation: parsed.data.rotation,
        opacity: parsed.data.opacity,
        is_visible: parsed.data.is_visible,
        is_locked: parsed.data.is_locked,
        label: parsed.data.label,
        config: parsed.data.config as unknown as Json,
      })
      .eq("id", item.id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }

  const { data, error } = await supabase
    .from("overlay_items")
    .insert({
      scene_id: parsed.data.scene_id,
      type: parsed.data.type,
      x: parsed.data.x,
      y: parsed.data.y,
      w: parsed.data.w,
      h: parsed.data.h,
      z_index: parsed.data.z_index,
      rotation: parsed.data.rotation,
      opacity: parsed.data.opacity,
      is_visible: parsed.data.is_visible,
      is_locked: parsed.data.is_locked,
      label: parsed.data.label,
      config: parsed.data.config as unknown as Json,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

function resolveClipFieldParentRefs(
  cfg: OverlayItemConfig,
  idMap: Map<string, string>
): OverlayItemConfig {
  if (typeof cfg !== "object" || !cfg || !("parentClipItemId" in cfg)) return cfg;
  const c = cfg as ClipDisplayFieldItemConfig;
  const nextParent = idMap.get(c.parentClipItemId) ?? c.parentClipItemId;
  if (nextParent === c.parentClipItemId) return cfg;
  return { ...c, parentClipItemId: nextParent };
}

export async function deleteOverlayItem(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("overlay_items").delete().eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function saveAllOverlayItems(
  sceneId: string,
  items: Array<{
    temp_id: string;
    id?: string;
    scene_id: string;
    type: string;
    x: number;
    y: number;
    w: number;
    h: number;
    z_index: number;
    rotation: number;
    opacity: number;
    is_visible: boolean;
    is_locked: boolean;
    label: string;
    config: OverlayItemConfig;
  }>
): Promise<{
  success: boolean;
  error: string | null;
  data: OverlaySceneWithItems | null;
}> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { success: false, error: "Unauthorized", data: null };
  }

  const idMap = new Map<string, string>();
  const existingItems = items.filter((i) => isPersistedOverlayItemId(i.id));
  const newItems = items.filter((i) => !isPersistedOverlayItemId(i.id));
  const keepIds = existingItems.map((i) => i.id!);

  const { data: dbItems } = await supabase
    .from("overlay_items")
    .select("id")
    .eq("scene_id", sceneId);

  const idsToDelete = (dbItems ?? [])
    .map((row) => row.id)
    .filter((id) => !keepIds.includes(id));

  if (idsToDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("overlay_items")
      .delete()
      .in("id", idsToDelete);
    if (delErr) return { success: false, error: delErr.message, data: null };
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
    const { error } = await supabase
      .from("overlay_items")
      .update({
        type: parsed.data.type,
        x: parsed.data.x,
        y: parsed.data.y,
        w: parsed.data.w,
        h: parsed.data.h,
        z_index: parsed.data.z_index,
        rotation: parsed.data.rotation,
        opacity: parsed.data.opacity,
        is_visible: parsed.data.is_visible,
        is_locked: parsed.data.is_locked,
        label: parsed.data.label,
        config: parsed.data.config as unknown as Json,
      })
      .eq("id", item.id!);
    if (error) return { success: false, error: error.message, data: null };
  }

  const newRoots = newItems.filter((i) => i.type !== "clip_display_field");
  const newChildren = newItems.filter((i) => i.type === "clip_display_field");

  if (newRoots.length > 0) {
    const insertPayloads: Database["public"]["Tables"]["overlay_items"]["Insert"][] =
      [];
    for (const item of newRoots) {
      const parsed = overlayItemSchema.safeParse({
        ...item,
        id: undefined,
        config: item.config,
      });
      if (!parsed.success) {
        return { success: false, error: parsed.error.message, data: null };
      }
      const p = parsed.data;
      insertPayloads.push({
        scene_id: sceneId,
        type: p.type,
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        z_index: p.z_index,
        rotation: p.rotation,
        opacity: p.opacity,
        is_visible: p.is_visible,
        is_locked: p.is_locked,
        label: p.label,
        config: p.config as unknown as Json,
      });
    }

    const { data: insertedRoots, error: insErr } = await supabase
      .from("overlay_items")
      .insert(insertPayloads)
      .select("id");

    if (insErr) return { success: false, error: insErr.message, data: null };
    if (!insertedRoots || insertedRoots.length !== newRoots.length) {
      return {
        success: false,
        error: "Failed to assign new item ids",
        data: null,
      };
    }

    newRoots.forEach((item, idx) => {
      const row = insertedRoots[idx];
      if (row?.id) idMap.set(item.temp_id, row.id);
    });
  }

  if (newChildren.length > 0) {
    const childPayloads: Database["public"]["Tables"]["overlay_items"]["Insert"][] =
      [];
    for (const item of newChildren) {
      const cfg = resolveClipFieldParentRefs(item.config, idMap);
      const parsed = overlayItemSchema.safeParse({
        ...item,
        id: undefined,
        config: cfg,
      });
      if (!parsed.success) {
        return { success: false, error: parsed.error.message, data: null };
      }
      const p = parsed.data;
      childPayloads.push({
        scene_id: sceneId,
        type: p.type,
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        z_index: p.z_index,
        rotation: p.rotation,
        opacity: p.opacity,
        is_visible: p.is_visible,
        is_locked: p.is_locked,
        label: p.label,
        config: p.config as unknown as Json,
      });
    }

    const { error: chErr } = await supabase.from("overlay_items").insert(childPayloads);
    if (chErr) return { success: false, error: chErr.message, data: null };
  }

  revalidatePath("/dashboard/overlays");

  const reloaded = await getOverlayScene(sceneId);
  if (reloaded.error || !reloaded.data) {
    return {
      success: true,
      error: null,
      data: null,
    };
  }
  return { success: true, error: null, data: reloaded.data };
}
