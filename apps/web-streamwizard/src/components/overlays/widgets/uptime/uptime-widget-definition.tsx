"use client";

import type { OverlayItem } from "@/types/overlays";
import { UPTIME_WIDGET_DEFAULT_SIZE, createDefaultUptimeWidgetConfig } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { UPTIME_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

/** Places one uptime widget, centred, labelled "Uptime 2" and so on. */
export function createUptimeWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [
    createCenteredRootItem(ctx, {
      type: "uptime_widget",
      size: UPTIME_WIDGET_DEFAULT_SIZE,
      label: "Uptime",
      config: createDefaultUptimeWidgetConfig(),
    }),
  ];
}
