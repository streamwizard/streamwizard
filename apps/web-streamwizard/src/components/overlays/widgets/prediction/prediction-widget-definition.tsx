"use client";

import type { OverlayItem } from "@/types/overlays";
import { PREDICTION_WIDGET_DEFAULT_SIZE, createDefaultPredictionWidgetConfig } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { PREDICTION_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

/** Places one prediction widget, centred, labelled "Prediction 2" and so on. */
export function createPredictionWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [
    createCenteredRootItem(ctx, {
      type: "prediction_widget",
      size: PREDICTION_WIDGET_DEFAULT_SIZE,
      label: "Prediction",
      config: createDefaultPredictionWidgetConfig(),
    }),
  ];
}
