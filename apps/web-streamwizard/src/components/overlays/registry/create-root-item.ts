import type { OverlayItem } from "@/types/overlays";
import type { CreateRootItemContext } from "./overlay-widget-registry.types";

export interface RootItemSpec {
  type: OverlayItem["type"];
  /** Default size. New widgets are authored at it, so they start at scale 1. */
  size: { w: number; h: number };
  /**
   * The layer name. A string gets the count appended ("Poll 2"); a function
   * gets the 1-based count of this type in the scene, new item included.
   */
  label: string | ((n: number) => string);
  config: OverlayItem["config"];
  /** Left edge in scene px. Defaults to horizontally centred. */
  x?: number;
  /** Top edge in scene px. Defaults to vertically centred. */
  y?: number;
}

/**
 * One new root item on top of the scene, centred unless `x`/`y` say
 * otherwise. Every widget definition builds its item here, so a new
 * `overlay_items` column needs a default in one place.
 */
export function createCenteredRootItem(ctx: CreateRootItemContext, spec: RootItemSpec): OverlayItem {
  const id = ctx.nextId();
  const { w, h } = spec.size;
  const n = ctx.scene.items.filter((i) => i.type === spec.type).length + 1;
  return {
    id,
    scene_id: ctx.scene.id,
    type: spec.type,
    x: spec.x ?? Math.round(ctx.scene.width / 2 - w / 2),
    y: spec.y ?? Math.round(ctx.scene.height / 2 - h / 2),
    w,
    h,
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
    label: typeof spec.label === "string" ? `${spec.label} ${n}` : spec.label(n),
    config: spec.config,
  };
}
