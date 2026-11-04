"use client";

import type { OverlayItem } from "@/types/overlays";
import { HYPE_TRAIN_WIDGET_DEFAULT_SIZE, createDefaultHypeTrainWidgetConfig } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { HYPE_TRAIN_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

/** Covers the whole scene so the train can roam all of it; labelled "Hype train 2" and so on. */
export function createHypeTrainWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [
    createCenteredRootItem(ctx, {
      type: "hype_train_widget",
      size: {
        w: ctx.scene.width || HYPE_TRAIN_WIDGET_DEFAULT_SIZE.w,
        h: ctx.scene.height || HYPE_TRAIN_WIDGET_DEFAULT_SIZE.h,
      },
      label: (n) => (n === 1 ? "Hype train" : `Hype train ${n}`),
      config: createDefaultHypeTrainWidgetConfig(),
      x: 0,
      y: 0,
    }),
  ];
}
