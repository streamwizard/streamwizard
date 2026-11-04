"use client";

import type { OverlayItem } from "@/types/overlays";
import { SLIDESHOW_WIDGET_DEFAULT_SIZE, createDefaultSlideshowWidgetConfig } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { SLIDESHOW_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

/** Places one slideshow widget, centred, labelled "Slideshow 2" and so on. */
export function createSlideshowWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [
    createCenteredRootItem(ctx, {
      type: "slideshow_widget",
      size: SLIDESHOW_WIDGET_DEFAULT_SIZE,
      label: "Slideshow",
      config: createDefaultSlideshowWidgetConfig(),
    }),
  ];
}
