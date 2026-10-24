"use client";

import { use } from "react";
import { OverlaySceneCanvas } from "@repo/ui/overlay";
import { OVERLAY_WIDGET_REGISTRY } from "@/components/overlays/registry/overlay-widget-registry";
import type { OverlayItem, RootOverlayItemType } from "@/types/overlays";
import { ShotBridge } from "../../shot-bridge";
import { shotScene } from "../../shot-scene";

/**
 * One widget, drawn exactly as the live overlay draws it.
 *
 * This mounts OverlaySceneCanvas, which is the same component
 * apps/web-overlay/[overlayId] renders, rather than the editor's CanvasContent
 * wrapper. The wrapper passes isEditor, which deliberately changes what you
 * see: the label widget shows a placeholder when empty, the media widgets say
 * "Pick an image in the settings", the goal widget adds editor-only chrome.
 * A docs page has to show what lands on stream.
 */
export default function WidgetShotPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { type } = use(params);
  const query = use(searchParams);

  const widgetType = type as RootOverlayItemType;
  const def = OVERLAY_WIDGET_REGISTRY[widgetType];
  if (!def?.createRootItems) {
    return <div style={{ color: "#fff", padding: 24 }}>Unknown widget type: {type}</div>;
  }

  // ?w and ?h override the widget's default box. Needed for the widgets that
  // default to the whole 1920x1080 scene, like the hype train and the emote
  // wall: shooting those at their default size buries the widget in a field
  // of empty backdrop.
  const size = {
    w: Number(query.w) || def.defaultSize.w,
    h: Number(query.h) || def.defaultSize.h,
  };
  const scene = shotScene({ id: `shot-${widgetType}`, width: size.w, height: size.h });

  let next = 0;
  const items = def
    .createRootItems({ scene, nextId: () => `shot-item-${next++}`, maxZ: 0 })
    // The widget is the whole picture here, so fill the stage with it whatever
    // the factory chose for a real canvas.
    .map((item) =>
      item.z_index === 1 ? { ...item, x: 0, y: 0, w: size.w, h: size.h } : item,
    );

  // ?preset=bar selects one of a widget family's designs. The config shapes are
  // per-widget unions, so this merge is asserted rather than inferred.
  const preset = query.preset;
  const withPreset: OverlayItem[] = preset
    ? items.map((item) =>
        item.type === widgetType
          ? ({
              ...item,
              config: { ...(item.config as unknown as Record<string, unknown>), preset },
            } as OverlayItem)
          : item,
      )
    : items;

  return (
    <div
      data-shot-stage
      style={{
        // Padding so type that overflows its box is not sliced off at the
        // frame edge, which is what a tight stage does to the goal widget.
        padding: 24,
        width: size.w + 48,
        height: size.h + 48,
        boxSizing: "border-box",
        // Widgets render transparent by design. A transparent PNG looks broken
        // in one of Mintlify's two themes, so give every shot a backdrop.
        background: "#0b0b12",
      }}
    >
      <ShotBridge sceneId={scene.id} />
      <OverlaySceneCanvas scene={scene} items={withPreset} />
    </div>
  );
}
