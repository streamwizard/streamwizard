"use client";

import type { OverlayItem } from "@/types/overlays";
import {
  IMAGE_WIDGET_DEFAULT_SIZE,
  VIDEO_WIDGET_DEFAULT_SIZE,
  createDefaultImageWidgetConfig,
  createDefaultVideoWidgetConfig,
  type MediaWidgetType,
} from "@repo/ui/overlay";
import type { CreateRootItemContext } from "../../registry/overlay-widget-registry.types";

export { IMAGE_WIDGET_DEFAULT_SIZE, VIDEO_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

const MEDIA_WIDGETS = {
  image_widget: { label: "Image", size: IMAGE_WIDGET_DEFAULT_SIZE, createConfig: createDefaultImageWidgetConfig },
  video_widget: { label: "Video", size: VIDEO_WIDGET_DEFAULT_SIZE, createConfig: createDefaultVideoWidgetConfig },
} as const;

/** Places one image or video widget, centred, labelled "Image 2" and so on. */
export function createMediaWidgetRootItems(type: MediaWidgetType) {
  return (ctx: CreateRootItemContext): OverlayItem[] => {
    const id = ctx.nextId();
    const { label, size, createConfig } = MEDIA_WIDGETS[type];
    const { w, h } = size;
    const n = ctx.scene.items.filter((i) => i.type === type).length + 1;
    return [
      {
        id,
        scene_id: ctx.scene.id,
        type,
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
        label: `${label} ${n}`,
        config: createConfig(),
      },
    ];
  };
}
