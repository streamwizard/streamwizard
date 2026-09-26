"use client";

import type { OverlayItem } from "@/types/overlays";
import { EMOTE_WIDGET_DEFAULT_SIZE, createDefaultEmoteWidgetConfig } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "../../registry/overlay-widget-registry.types";

export { EMOTE_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

/** Places one emote wall covering the whole scene, on top. It is see-through wherever no emote is flying. */
export function createEmoteWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  const id = ctx.nextId();
  // The scene's own size, so emotes can fly anywhere on any canvas size.
  const w = ctx.scene.width || EMOTE_WIDGET_DEFAULT_SIZE.w;
  const h = ctx.scene.height || EMOTE_WIDGET_DEFAULT_SIZE.h;
  const n = ctx.scene.items.filter((i) => i.type === "emote_widget").length + 1;
  return [
    {
      id,
      scene_id: ctx.scene.id,
      type: "emote_widget",
      x: 0,
      y: 0,
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
      label: n === 1 ? "Emote wall" : `Emote wall ${n}`,
      config: createDefaultEmoteWidgetConfig(),
    },
  ];
}
