"use client";

import type { OverlayItem } from "@repo/ui/components/overlay/types/item";
import { DEFAULT_CLOCK_WIDGET_ITEM_CONFIG, CLOCK_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { CLOCK_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

export function createClockWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [
    createCenteredRootItem(ctx, {
      type: "clock_widget",
      size: CLOCK_WIDGET_DEFAULT_SIZE,
      label: "Clock",
      config: { ...DEFAULT_CLOCK_WIDGET_ITEM_CONFIG },
    }),
  ];
}
