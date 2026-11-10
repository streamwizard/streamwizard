"use client";

import type { OverlayItem } from "@repo/ui/components/overlay/types/item";
import { createDefaultTimerWidgetConfig, TIMER_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { TIMER_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

export function createTimerWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [
    createCenteredRootItem(ctx, {
      type: "timer_widget",
      size: TIMER_WIDGET_DEFAULT_SIZE,
      label: "Countdown",
      config: createDefaultTimerWidgetConfig(),
    }),
  ];
}
