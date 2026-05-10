"use client";

import type { OverlayItem } from "@/types/overlays";
import {
  createClipDisplayFieldChildItems,
  DEFAULT_CLIPS_WIDGET_ITEM_CONFIG,
} from "@/types/overlays";
import type { CreateRootItemContext } from "../../registry/overlay-widget-registry.types";

export const CLIPS_WIDGET_DEFAULT_SIZE = { w: 400, h: 300 } as const;

export function createClipsWidgetRootItems(
  ctx: CreateRootItemContext
): OverlayItem[] {
  const parentId = ctx.nextId();
  const { w, h } = CLIPS_WIDGET_DEFAULT_SIZE;
  const parent: OverlayItem = {
    id: parentId,
    scene_id: ctx.scene.id,
    type: "clips_widget",
    x: Math.round(ctx.scene.width / 2 - w / 2),
    y: Math.round(ctx.scene.height / 2 - h / 2),
    w,
    h,
    z_index: ctx.maxZ + 1,
    rotation: 0,
    opacity: 1,
    is_visible: true,
    is_locked: false,
    label: `Clips Widget ${ctx.scene.items.filter((i) => i.type === "clips_widget").length + 1}`,
    config: { ...DEFAULT_CLIPS_WIDGET_ITEM_CONFIG },
  };
  const children = createClipDisplayFieldChildItems(
    ctx.scene.id,
    parentId,
    parent,
    ctx.nextId
  );
  return [parent, ...children];
}
