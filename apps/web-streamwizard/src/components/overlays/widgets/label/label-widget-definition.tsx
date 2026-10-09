"use client";

import type { OverlayItem } from "@/types/overlays";
import {
  EVENT_LIST_LABEL_ID,
  LABEL_WIDGET_DEFAULT_SIZE,
  createDefaultLabelWidgetConfig,
  type LabelWidgetItemConfig,
} from "@repo/ui/overlay";
import type { CreateRootItemContext } from "../../registry/overlay-widget-registry.types";

export { LABEL_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

/** Canvas size per kind of label, applied when switching between kinds. */
export const LABEL_WIDGET_SIZES = {
  single: { w: 480, h: 64 },
  stacked: { w: 360, h: 260 },
  row: { w: 960, h: 64 },
} as const;

function createLabelItem(
  ctx: CreateRootItemContext,
  size: { w: number; h: number },
  label: string,
  config: LabelWidgetItemConfig,
): OverlayItem {
  const { w, h } = size;
  return {
    id: ctx.nextId(),
    scene_id: ctx.scene.id,
    type: "label_widget",
    x: Math.round(ctx.scene.width / 2 - w / 2),
    y: Math.round(ctx.scene.height / 2 - h / 2),
    w,
    h,
    // New widgets are authored at their default size, so they start at scale 1.
    design_w: w,
    design_h: h,
    crop_top: 0,
    crop_right: 0,
    crop_bottom: 0,
    crop_left: 0,
    anchor_x: "left",
    anchor_y: "top",
    z_index: ctx.maxZ + 1,
    rotation: 0,
    flip_h: false,
    flip_v: false,
    opacity: 1,
    is_visible: true,
    is_locked: false,
    label,
    config,
  };
}

/** Places one label widget, centred, labelled "Label 2" and so on. */
export function createLabelWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  const n = ctx.scene.items.filter((i) => i.type === "label_widget").length + 1;
  return [createLabelItem(ctx, LABEL_WIDGET_DEFAULT_SIZE, `Label ${n}`, createDefaultLabelWidgetConfig())];
}

/**
 * Places a label widget already set up as an event list: the library's
 * "Event list" card. It is a label like any other afterwards, so the label
 * picker in its settings can still turn it into something else.
 */
export function createEventListRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  const n = ctx.scene.items.filter((i) => i.type === "label_widget").length + 1;
  return [
    createLabelItem(ctx, LABEL_WIDGET_SIZES.stacked, `Event list ${n}`, {
      ...createDefaultLabelWidgetConfig(),
      labelId: EVENT_LIST_LABEL_ID,
      period: "stream",
      // A list of events says what it is; a heading above it only takes a row.
      prefix: "",
      align: "left",
      fontSize: 22,
    }),
  ];
}
