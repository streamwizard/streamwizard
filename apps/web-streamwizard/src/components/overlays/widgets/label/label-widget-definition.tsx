"use client";

import type { OverlayItem } from "@repo/ui/components/overlay/types/item";
import {
  EVENT_LIST_LABEL_ID,
  LABEL_WIDGET_DEFAULT_SIZE,
  createDefaultLabelWidgetConfig,
} from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { LABEL_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

/** Canvas size per kind of label, applied when switching between kinds. */
export const LABEL_WIDGET_SIZES = {
  single: { w: 480, h: 64 },
  stacked: { w: 360, h: 260 },
  row: { w: 960, h: 64 },
} as const;

/** Places one label widget, centred, labelled "Label 2" and so on. */
export function createLabelWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [
    createCenteredRootItem(ctx, {
      type: "label_widget",
      size: LABEL_WIDGET_DEFAULT_SIZE,
      label: "Label",
      config: createDefaultLabelWidgetConfig(),
    }),
  ];
}

/**
 * Places a label widget already set up as an event list: the library's
 * "Event list" card. It is a label like any other afterwards, so the label
 * picker in its settings can still turn it into something else.
 */
export function createEventListRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [
    createCenteredRootItem(ctx, {
      type: "label_widget",
      size: LABEL_WIDGET_SIZES.stacked,
      label: "Event list",
      config: {
        ...createDefaultLabelWidgetConfig(),
        labelId: EVENT_LIST_LABEL_ID,
        period: "stream",
        // A list of events says what it is; a heading above it only takes a row.
        prefix: "",
        align: "left",
        fontSize: 22,
      },
    }),
  ];
}
