"use client";

import type { OverlayItem } from "@repo/ui/components/overlay/types/item";
import { EMOTE_WIDGET_DEFAULT_SIZE, createDefaultEmoteWidgetConfig } from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { EMOTE_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

/** Places one emote wall covering the whole scene, on top. It is see-through wherever no emote is flying. */
export function createEmoteWidgetRootItems(ctx: CreateRootItemContext): OverlayItem[] {
  return [
    createCenteredRootItem(ctx, {
      type: "emote_widget",
      // The scene's own size, so emotes can fly anywhere on any canvas size.
      size: {
        w: ctx.scene.width || EMOTE_WIDGET_DEFAULT_SIZE.w,
        h: ctx.scene.height || EMOTE_WIDGET_DEFAULT_SIZE.h,
      },
      label: (n) => (n === 1 ? "Emote wall" : `Emote wall ${n}`),
      config: createDefaultEmoteWidgetConfig(),
      x: 0,
      y: 0,
    }),
  ];
}
