"use client";

import type { OverlayItem } from "@/types/overlays";
import { SHAPE_WIDGET_DEFAULT_SIZE, createDefaultShapeWidgetConfig } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { SHAPE_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

/** Places one shape widget, centred, labelled "Shape 2" and so on. */
export function createShapeWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [
    createCenteredRootItem(ctx, {
      type: "shape_widget",
      size: SHAPE_WIDGET_DEFAULT_SIZE,
      label: "Shape",
      config: createDefaultShapeWidgetConfig(),
    }),
  ];
}
