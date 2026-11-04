"use client";

import type { OverlayItem } from "@/types/overlays";
import {
  createClipDisplayFieldChildItems,
  DEFAULT_CLIPS_WIDGET_ITEM_CONFIG,
  CLIPS_WIDGET_DEFAULT_SIZE,
} from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { CLIPS_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

export function createClipsWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  const parent = createCenteredRootItem(ctx, {
    type: "clips_widget",
    size: CLIPS_WIDGET_DEFAULT_SIZE,
    label: "Clips",
    config: { ...DEFAULT_CLIPS_WIDGET_ITEM_CONFIG },
  });
  const children = createClipDisplayFieldChildItems(
    ctx.scene.id,
    parent.id,
    parent,
    ctx.nextId
  );
  return [parent, ...children];
}
