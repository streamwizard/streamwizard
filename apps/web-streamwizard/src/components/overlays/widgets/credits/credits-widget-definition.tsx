"use client";

import type { OverlayItem } from "@repo/ui/components/overlay/types/item";
import { CREDITS_WIDGET_DEFAULT_SIZE, createDefaultCreditsWidgetConfig } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { CREDITS_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

/** Places one credits widget, centred, labelled "End credits 2" and so on. */
export function createCreditsWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [
    createCenteredRootItem(ctx, {
      type: "credits_widget",
      size: CREDITS_WIDGET_DEFAULT_SIZE,
      label: "End credits",
      config: createDefaultCreditsWidgetConfig(),
    }),
  ];
}
