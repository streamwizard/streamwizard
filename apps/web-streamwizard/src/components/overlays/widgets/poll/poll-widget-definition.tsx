"use client";

import type { OverlayItem } from "@/types/overlays";
import { POLL_WIDGET_DEFAULT_SIZE, createDefaultPollWidgetConfig } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { POLL_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

/** Places one poll widget, centred, labelled "Poll 2" and so on. */
export function createPollWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [
    createCenteredRootItem(ctx, {
      type: "poll_widget",
      size: POLL_WIDGET_DEFAULT_SIZE,
      label: "Poll",
      config: createDefaultPollWidgetConfig(),
    }),
  ];
}
