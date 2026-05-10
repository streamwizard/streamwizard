"use client";

import type { OverlayItem } from "@/types/overlays";
import { createDefaultTimerWidgetConfig } from "@/types/overlays";
import type { CreateRootItemContext } from "../../registry/overlay-widget-registry.types";

export const TIMER_WIDGET_DEFAULT_SIZE = { w: 420, h: 100 } as const;

export function createTimerWidgetRootItems(
  ctx: CreateRootItemContext
): OverlayItem[] {
  const id = ctx.nextId();
  const { w, h } = TIMER_WIDGET_DEFAULT_SIZE;
  const n =
    ctx.scene.items.filter((i) => i.type === "timer_widget").length + 1;
  return [
    {
      id,
      scene_id: ctx.scene.id,
      type: "timer_widget",
      x: Math.round(ctx.scene.width / 2 - w / 2),
      y: Math.round(ctx.scene.height / 2 - h / 2),
      w,
      h,
      z_index: ctx.maxZ + 1,
      rotation: 0,
      opacity: 1,
      is_visible: true,
      is_locked: false,
      label: `Countdown ${n}`,
      config: createDefaultTimerWidgetConfig(),
    },
  ];
}
