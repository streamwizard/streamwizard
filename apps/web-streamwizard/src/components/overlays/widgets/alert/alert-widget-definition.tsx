"use client";

import type { OverlayItem } from "@repo/ui/components/overlay/types/item";
import {
  ALERT_WIDGET_DEFAULT_SIZE,
  createDefaultAlertWidgetConfig,
} from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { ALERT_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

export function createAlertWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [
    createCenteredRootItem(ctx, {
      type: "alert_widget",
      size: ALERT_WIDGET_DEFAULT_SIZE,
      label: (n) => (n === 1 ? "Alert box" : `Alert box ${n}`),
      config: createDefaultAlertWidgetConfig(),
      y: Math.round(ctx.scene.height * 0.12),
    }),
  ];
}
