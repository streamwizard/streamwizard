"use client";

import type { OverlayItem } from "@/types/overlays";
import { COMBO_WIDGET_DEFAULT_SIZE, createDefaultComboWidgetConfig } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { COMBO_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

/** Places one emote combo counter, centred, labelled "Emote combo 2" and so on. */
export function createComboWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [
    createCenteredRootItem(ctx, {
      type: "combo_widget",
      size: COMBO_WIDGET_DEFAULT_SIZE,
      label: (n) => (n === 1 ? "Emote combo" : `Emote combo ${n}`),
      config: createDefaultComboWidgetConfig(),
    }),
  ];
}
