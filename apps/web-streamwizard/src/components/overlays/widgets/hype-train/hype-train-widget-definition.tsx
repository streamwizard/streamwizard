"use client";

import type { OverlayItem } from "@/types/overlays";
import { HYPE_TRAIN_WIDGET_DEFAULT_SIZE, createDefaultHypeTrainWidgetConfig } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "../../registry/overlay-widget-registry.types";

export { HYPE_TRAIN_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

/** Covers the whole scene so the train can roam all of it; labelled "Hype train 2" and so on. */
export function createHypeTrainWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  const id = ctx.nextId();
  const w = ctx.scene.width || HYPE_TRAIN_WIDGET_DEFAULT_SIZE.w;
  const h = ctx.scene.height || HYPE_TRAIN_WIDGET_DEFAULT_SIZE.h;
  const n = ctx.scene.items.filter((i) => i.type === "hype_train_widget").length + 1;
  return [
    {
      id,
      scene_id: ctx.scene.id,
      type: "hype_train_widget",
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
      label: n === 1 ? "Hype train" : `Hype train ${n}`,
      config: createDefaultHypeTrainWidgetConfig(),
    },
  ];
}
