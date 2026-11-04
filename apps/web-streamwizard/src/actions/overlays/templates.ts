"use server";

import { revalidatePath } from "next/cache";
import { track } from "@/lib/tracking/track";
import { toActionError, zodErrorMessage } from "@/lib/action-error";
import type { Database, Json } from "@repo/supabase";
import {
  getOverlayTemplates as getTemplateRows,
  getOverlayTemplateBySlug,
  getWidgetTemplatesByIds,
  type WidgetTemplateSource,
} from "@repo/supabase/queries/overlays/templates";
import {
  createOverlayScene as createSceneRow,
  deleteOverlayScene as deleteSceneRow,
  insertOverlayItems,
  insertOverlayItemsReturningIds,
  updateOverlayItemData,
} from "@repo/supabase/queries/overlays/overlays";
import {
  insertOverlayWidget,
  insertOverlayWidgetInstance,
  overlayWidgetColumns,
} from "@repo/supabase/queries/overlays/widgets";
import { createClipDisplayFieldChildItems } from "@repo/ui/overlay";
import { createSceneSchema } from "@/schemas/overlay";
import { createFromTemplateSchema } from "@/schemas/overlay-actions";
import { tryAuthContext } from "@/lib/auth";
import { generateSlug } from "@/lib/overlays/overlay-slug";
import { OVERLAYS_ERROR_SCOPE } from "@/lib/overlays/overlay-items";

const TEMPLATE_FAILED = "Couldn't create the overlay from that template. Try again?";

/**
 * Published widgetTemplate templates for the "start from" picker. Catalog rows, so any
 * signed-in user can read them.
 */
export async function getOverlayTemplates() {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };

  const { data, error } = await getTemplateRows(ctx.supabase);
  if (error) {
    return { data: null, error: toActionError(error, OVERLAYS_ERROR_SCOPE, "Couldn't load the templates. Try again?") };
  }
  return { data, error: null };
}

export async function createOverlayFromTemplate(input: {
  name: string;
  templateId: string;
  render_mode?: "obs" | "gps";
}) {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  const { supabase, user } = ctx;
  const parsedInput = createFromTemplateSchema.safeParse(input);
  if (!parsedInput.success) return { data: null, error: "Check the overlay name and template, then try again." };
  const formData = parsedInput.data;

  // templateId is the template's slug ("starting-soon"), not its uuid.
  const {
    template,
    items: templateItems,
    error: templateError,
  } = await getOverlayTemplateBySlug(supabase, formData.templateId);
  if (templateError) {
    return { data: null, error: toActionError(templateError, OVERLAYS_ERROR_SCOPE, TEMPLATE_FAILED) };
  }
  if (!template || !templateItems) return { data: null, error: "Unknown template" };

  // Widget-template sources for the items that ship with a custom widget.
  const widgetTemplateIds = [
    ...new Set(templateItems.map((i) => i.widget_template_id).filter((id): id is string => !!id)),
  ];
  const widgetTemplatesById = new Map<string, WidgetTemplateSource>();
  if (widgetTemplateIds.length > 0) {
    const { data: widgetTemplates, error: widgetTemplatesError } = await getWidgetTemplatesByIds(
      supabase,
      widgetTemplateIds,
    );
    if (widgetTemplatesError) {
      return { data: null, error: toActionError(widgetTemplatesError, OVERLAYS_ERROR_SCOPE, TEMPLATE_FAILED) };
    }
    for (const wt of widgetTemplates ?? []) widgetTemplatesById.set(wt.id, wt);
  }

  const parsed = createSceneSchema.safeParse({
    name: formData.name,
    width: template.width,
    height: template.height,
  });
  if (!parsed.success) return { data: null, error: zodErrorMessage(parsed.error, "Check the overlay name, then try again.") };

  const { data: scene, error: sceneError } = await createSceneRow(supabase, {
    user_id: user.id,
    name: parsed.data.name,
    slug: generateSlug(parsed.data.name),
    width: template.width,
    height: template.height,
    render_mode: formData.render_mode ?? template.render_mode,
    is_active: true,
  });

  if (sceneError) {
    return { data: null, error: toActionError(sceneError, OVERLAYS_ERROR_SCOPE, TEMPLATE_FAILED) };
  }

  if (templateItems.length > 0) {
    // A scene without its items is a broken template instance, so every failure
    // below deletes the scene again rather than leaving a half-built overlay.
    const abort = async (error: unknown) => {
      const message = toActionError(error ?? new Error("Template copy wrote no row"), OVERLAYS_ERROR_SCOPE, TEMPLATE_FAILED);
      await deleteSceneRow(supabase, scene.id, user.id);
      return { data: null, error: message };
    };

    // Widget-template items get their own copy of the source, owned by
    // the user (same as installing it from the library's Starters tab).
    const widgetTemplateItemIds = new Map<number, string>();
    for (const [idx, item] of templateItems.entries()) {
      if (!item.widget_template_id) continue;
      const widgetTemplate = widgetTemplatesById.get(item.widget_template_id);
      if (!widgetTemplate) continue;
      const { data: widget, error: widgetError } = await insertOverlayWidget(
        supabase,
        overlayWidgetColumns(widgetTemplate, user.id),
      );
      if (widgetError || !widget) {
        return abort(widgetError);
      }
      widgetTemplateItemIds.set(idx, widget.id);
    }

    const roots = templateItems.map((item, idx) => ({
      scene_id: scene.id as string,
      type: item.type,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      // Template items are authored at their placed size, so they start at scale 1.
      design_w: item.w,
      design_h: item.h,
      crop_top: 0,
      crop_right: 0,
      crop_bottom: 0,
      crop_left: 0,
      z_index: item.z_index,
      rotation: 0,
      flip_h: false,
      flip_v: false,
      opacity: 1,
      is_visible: true,
      is_locked: false,
      label: item.label,
      config: (widgetTemplateItemIds.has(idx)
        ? { ...(item.config as object), widget_id: widgetTemplateItemIds.get(idx), instance_id: "" }
        : item.config) as unknown as Json,
    }));

    const { data: inserted, error: itemsError } = await insertOverlayItemsReturningIds(supabase, roots);
    if (itemsError || !inserted || inserted.length !== roots.length) {
      return abort(itemsError);
    }

    // Wire each widget-template item to its own instance row (holds per-item
    // field values / state), then point the item config at it.
    for (const [idx, widgetId] of widgetTemplateItemIds) {
      const itemId = inserted[idx]!.id;
      const { data: instance, error: instanceError } = await insertOverlayWidgetInstance(supabase, {
        overlay_item_id: itemId,
        widget_id: widgetId,
        user_id: user.id,
      });
      if (instanceError || !instance) {
        return abort(instanceError);
      }
      const { error: cfgError } = await updateOverlayItemData(supabase, itemId, {
        config: {
          ...(templateItems[idx]!.config as object),
          widget_id: widgetId,
          instance_id: instance.id,
        } as unknown as Json,
      });
      if (cfgError) return abort(cfgError);
    }

    // Clips widgets carry per-field child rows (title/creator/game/...) that
    // every clips widget is expected to have; generate them like the editor does.
    const childRows: Database["public"]["Tables"]["overlay_items"]["Insert"][] = [];
    templateItems.forEach((item, idx) => {
      if (item.type !== "clips_widget") return;
      const parentId = inserted[idx]!.id;
      const children = createClipDisplayFieldChildItems(
        scene.id,
        parentId,
        { x: item.x, y: item.y, w: item.w, h: item.h, z_index: item.z_index },
        () => crypto.randomUUID(),
      );
      for (const child of children) {
        childRows.push({
          scene_id: scene.id,
          type: child.type,
          x: child.x,
          y: child.y,
          anchor_x: child.anchor_x,
          anchor_y: child.anchor_y,
          w: child.w,
          h: child.h,
          design_w: child.design_w,
          design_h: child.design_h,
          crop_top: child.crop_top,
          crop_right: child.crop_right,
          crop_bottom: child.crop_bottom,
          crop_left: child.crop_left,
          z_index: child.z_index,
          rotation: child.rotation,
          opacity: child.opacity,
          is_visible: child.is_visible,
          is_locked: child.is_locked,
          label: child.label,
          config: child.config as unknown as Json,
        });
      }
    });

    if (childRows.length > 0) {
      const { error: childError } = await insertOverlayItems(supabase, childRows);
      if (childError) return abort(childError);
    }
  }

  await track(
    "overlay_created",
    { overlay_id: scene.id, template: formData.templateId, render_mode: formData.render_mode ?? "obs" },
    user,
  );
  revalidatePath("/dashboard/overlays");
  return { data: scene, error: null };
}
