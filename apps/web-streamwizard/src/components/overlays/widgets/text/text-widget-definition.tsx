"use client";

import type { OverlayItem } from "@/types/overlays";
import { DEFAULT_TEXT_WIDGET_ITEM_CONFIG, TEXT_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "../../registry/overlay-widget-registry.types";

export { TEXT_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

export function createTextWidgetRootItems(
  ctx: CreateRootItemContext
): OverlayItem[] {
  const id = ctx.nextId();
  const { w, h } = TEXT_WIDGET_DEFAULT_SIZE;
  const n =
    ctx.scene.items.filter((i) => i.type === "text_widget").length + 1;
  return [
    {
      id,
      scene_id: ctx.scene.id,
      type: "text_widget",
      x: Math.round(ctx.scene.width / 2 - w / 2),
      y: Math.round(ctx.scene.height / 2 - h / 2),
      w,
      h,
      z_index: ctx.maxZ + 1,
      rotation: 0,
      opacity: 1,
      is_visible: true,
      is_locked: false,
      label: `Text ${n}`,
      config: { ...DEFAULT_TEXT_WIDGET_ITEM_CONFIG },
    },
  ];
}
