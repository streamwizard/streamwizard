"use client";

import type { OverlayItem } from "@repo/ui/components/overlay/types/item";
import { CHAT_WIDGET_DEFAULT_SIZE, createDefaultChatWidgetConfig } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { CHAT_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

export function createChatWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [
    createCenteredRootItem(ctx, {
      type: "chat_widget",
      size: CHAT_WIDGET_DEFAULT_SIZE,
      label: "Chat",
      config: createDefaultChatWidgetConfig(),
    }),
  ];
}
