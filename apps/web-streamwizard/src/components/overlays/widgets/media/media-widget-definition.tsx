"use client";

import type { OverlayItem } from "@/types/overlays";
import {
  IMAGE_WIDGET_DEFAULT_SIZE,
  VIDEO_WIDGET_DEFAULT_SIZE,
  createDefaultImageWidgetConfig,
  createDefaultVideoWidgetConfig,
  type MediaWidgetType,
} from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { IMAGE_WIDGET_DEFAULT_SIZE, VIDEO_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

const MEDIA_WIDGETS = {
  image_widget: { label: "Image", size: IMAGE_WIDGET_DEFAULT_SIZE, createConfig: createDefaultImageWidgetConfig },
  video_widget: { label: "Video", size: VIDEO_WIDGET_DEFAULT_SIZE, createConfig: createDefaultVideoWidgetConfig },
} as const;

/** Places one image or video widget, centred, labelled "Image 2" and so on. */
export function createMediaWidgetRootItems(type: MediaWidgetType) {
  return (ctx: CreateRootItemContext): OverlayItem[] => {
    const { label, size, createConfig } = MEDIA_WIDGETS[type];
    return [createCenteredRootItem(ctx, { type, size, label, config: createConfig() })];
  };
}
