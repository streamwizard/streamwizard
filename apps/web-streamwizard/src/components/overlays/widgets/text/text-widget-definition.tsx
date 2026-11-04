"use client";

import type { OverlayItem } from "@/types/overlays";
import { DEFAULT_TEXT_WIDGET_ITEM_CONFIG, TEXT_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { TEXT_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

export function createTextWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [
    createCenteredRootItem(ctx, {
      type: "text_widget",
      size: TEXT_WIDGET_DEFAULT_SIZE,
      label: "Text",
      config: { ...DEFAULT_TEXT_WIDGET_ITEM_CONFIG },
    }),
  ];
}
