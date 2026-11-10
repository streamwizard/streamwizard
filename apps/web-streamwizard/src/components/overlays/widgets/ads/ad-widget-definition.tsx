"use client";

import type { OverlayItem } from "@repo/ui/components/overlay/types/item";
import { AD_WIDGET_DEFAULT_SIZE, createDefaultAdWidgetConfig } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { AD_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

/** Places one ad widget, centred, labelled "Ads 2" and so on. */
export function createAdWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [
    createCenteredRootItem(ctx, {
      type: "ad_widget",
      size: AD_WIDGET_DEFAULT_SIZE,
      label: "Ads",
      config: createDefaultAdWidgetConfig(),
    }),
  ];
}
