"use client";

import type { OverlayItem } from "@/types/overlays";
import { COMBO_WIDGET_DEFAULT_SIZE, createDefaultComboWidgetConfig } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "../../registry/overlay-widget-registry.types";

export { COMBO_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

/** Places one emote combo counter, centred, labelled "Emote combo 2" and so on. */
export function createComboWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  const id = ctx.nextId();
  const { w, h } = COMBO_WIDGET_DEFAULT_SIZE;
  const n = ctx.scene.items.filter((i) => i.type === "combo_widget").length + 1;
  return [
    {
      id,
      scene_id: ctx.scene.id,
      type: "combo_widget",
      x: Math.round(ctx.scene.width / 2 - w / 2),
      y: Math.round(ctx.scene.height / 2 - h / 2),
      w,
      h,
      // New widgets are authored at their default size, so they start at scale 1.
      design_w: w,
      design_h: h,
      crop_top: 0,
      crop_right: 0,
      crop_bottom: 0,
      crop_left: 0,
      anchor_x: "left",
      anchor_y: "top",
      z_index: ctx.maxZ + 1,
      rotation: 0,
      flip_h: false,
      flip_v: false,
      opacity: 1,
      is_visible: true,
      is_locked: false,
      label: n === 1 ? "Emote combo" : `Emote combo ${n}`,
      config: createDefaultComboWidgetConfig(),
    },
  ];
}
