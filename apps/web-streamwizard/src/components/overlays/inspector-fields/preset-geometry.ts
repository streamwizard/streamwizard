import { getDesignSize, getItemScale, hasCrop } from "@repo/ui/overlay";
import type { OverlayItem } from "@/types/overlays";

/**
 * The box a design preset is drawn for, at the item's current scale, keeping
 * the widget's centre where it was. Spread into the same `updateItem` as the
 * config change so one undo takes the look and the resize back together.
 *
 * Null when nothing should move: the item is already that size, or it's
 * cropped. A crop is cut for one shape, and resizing under it would move what
 * the streamer framed.
 */
export function presetGeometry(item: OverlayItem, target: { w: number; h: number }): Partial<OverlayItem> | null {
  if (hasCrop(item)) return null;
  const design = getDesignSize(item);
  if (target.w === design.w && target.h === design.h) return null;
  const scale = getItemScale(item);
  const w = Math.round(target.w * scale);
  const h = Math.round(target.h * scale);
  // x/y are offsets from the anchor; only a centre anchor already keeps the centre.
  const dx = item.anchor_x === "center" ? 0 : (item.w - w) / 2;
  const dy = item.anchor_y === "center" ? 0 : (item.h - h) / 2;
  return {
    design_w: target.w,
    design_h: target.h,
    w,
    h,
    x: Math.round(item.x + dx),
    y: Math.round(item.y + dy),
  };
}
