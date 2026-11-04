"use client";

import type { OverlayItem } from "@/types/overlays";
import { DEFAULT_CUSTOM_WIDGET_ITEM_CONFIG } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export const CUSTOM_WIDGET_DEFAULT_SIZE = { w: 400, h: 300 };

export function createCustomWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [
    createCenteredRootItem(ctx, {
      type: "custom_widget",
      size: CUSTOM_WIDGET_DEFAULT_SIZE,
      label: "Custom Widget",
      config: { ...DEFAULT_CUSTOM_WIDGET_ITEM_CONFIG },
    }),
  ];
}
