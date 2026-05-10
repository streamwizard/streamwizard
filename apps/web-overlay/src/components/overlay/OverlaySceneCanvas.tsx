"use client";

import type { OverlayItemRow, OverlaySceneRow } from "@/app/actions/overlay";
import type { OverlayItem } from "@repo/ui/overlay";
import type { ReactNode } from "react";
import { useMemo } from "react";
import {
  collectOverlayGoogleFontFamilies,
  getOverlayWidgetRegistration,
} from "@/components/widgets/registry";
import { overlayItemFromDbRow, useGoogleFonts } from "@repo/ui/overlay";

function OverlayLayerWrapper({
  item,
  children,
}: {
  item: OverlayItem;
  children: ReactNode;
}) {
  const opacity =
    typeof item.opacity === "number" && Number.isFinite(item.opacity)
      ? Math.min(1, Math.max(0, item.opacity))
      : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: item.x,
        top: item.y,
        width: item.w,
        height: item.h,
        zIndex: item.z_index,
        opacity,
        transform: `rotate(${item.rotation}deg)`,
        transformOrigin: "center center",
        pointerEvents: "none",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

export function OverlaySceneCanvas({
  scene,
  items,
}: {
  scene: OverlaySceneRow;
  items: OverlayItemRow[];
}) {
  const typedItems = useMemo(() => items.map(overlayItemFromDbRow), [items]);
  const fonts = useMemo(
    () => collectOverlayGoogleFontFamilies(typedItems),
    [typedItems]
  );
  useGoogleFonts(fonts);

  return (
    <div
      style={{
        position: "relative",
        width: scene.width,
        height: scene.height,
        overflow: "hidden",
        background: "transparent",
      }}
    >
      {typedItems.map((item) => {
        const reg = getOverlayWidgetRegistration(item.type);
        if (!reg) return null;
        const Widget = reg.Component;
        return (
          <OverlayLayerWrapper key={item.id} item={item}>
            <Widget scene={scene} item={item} />
          </OverlayLayerWrapper>
        );
      })}
    </div>
  );
}
