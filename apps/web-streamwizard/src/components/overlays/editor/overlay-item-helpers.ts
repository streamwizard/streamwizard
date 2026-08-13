import { clampCrop, getCropInsets, getDesignSize } from "@repo/ui/overlay";
import {
  getOverlayWidgetDefinition,
  isRootLayerType,
  isRootOverlayDefinition,
} from "@/components/overlays/registry/overlay-widget-registry";
import type { OverlayItem, OverlaySceneWithItems } from "@/types/overlays";
import { asClipDisplayFieldConfig } from "@/types/overlays";

/** Pure geometry/item helpers behind the overlay editor store. No store access. */

export const MIN_ITEM_SIZE = 50;

let tempIdCounter = 0;

export function nextTempId(): string {
  tempIdCounter++;
  return `temp-${tempIdCounter}`;
}

/**
 * Keep an item inside the scene: size capped to scene dims, position so the
 * whole rect stays in-bounds. Single choke point for move/resize/nudge/inspector.
 *
 * The design box lives outside scene space (it is what the content is drawn at
 * before scaling), so it only gets a lower bound. When a caller changes the
 * rendered size without saying what the design size should be, the design box
 * is left alone and the content simply scales — that is the whole point.
 */
export function clampGeometry(
  item: OverlayItem,
  updates: Partial<OverlayItem>,
  scene: { width: number; height: number }
): Partial<OverlayItem> {
  const w = Math.min(Math.max(MIN_ITEM_SIZE, updates.w ?? item.w), scene.width);
  const h = Math.min(Math.max(MIN_ITEM_SIZE, updates.h ?? item.h), scene.height);
  const x = Math.min(Math.max(0, updates.x ?? item.x), scene.width - w);
  const y = Math.min(Math.max(0, updates.y ?? item.y), scene.height - h);
  const geometry: Partial<OverlayItem> = { ...updates, x, y, w, h };
  if (updates.design_w !== undefined) {
    geometry.design_w = Math.max(MIN_ITEM_SIZE, updates.design_w);
  }
  if (updates.design_h !== undefined) {
    geometry.design_h = Math.max(MIN_ITEM_SIZE, updates.design_h);
  }

  if (touchesCrop(updates)) {
    const design = {
      w: geometry.design_w ?? getDesignSize(item).w,
      h: geometry.design_h ?? getDesignSize(item).h,
    };
    const current = getCropInsets(item);
    const crop = clampCrop(
      {
        top: updates.crop_top ?? current.top,
        right: updates.crop_right ?? current.right,
        bottom: updates.crop_bottom ?? current.bottom,
        left: updates.crop_left ?? current.left,
      },
      design
    );
    geometry.crop_top = crop.top;
    geometry.crop_right = crop.right;
    geometry.crop_bottom = crop.bottom;
    geometry.crop_left = crop.left;
  }

  return geometry;
}

export function touchesCrop(updates: Partial<OverlayItem>): boolean {
  return (
    updates.crop_top !== undefined ||
    updates.crop_right !== undefined ||
    updates.crop_bottom !== undefined ||
    updates.crop_left !== undefined
  );
}

export function touchesGeometry(updates: Partial<OverlayItem>): boolean {
  return (
    updates.x !== undefined ||
    updates.y !== undefined ||
    updates.w !== undefined ||
    updates.h !== undefined ||
    updates.design_w !== undefined ||
    updates.design_h !== undefined ||
    touchesCrop(updates)
  );
}

/** Ids removed when deleting a root: itself plus any registry-defined children. */
export function cascadeIds(scene: OverlaySceneWithItems, id: string): Set<string> {
  const ids = new Set<string>([id]);
  const item = scene.items.find((i) => i.id === id);
  const def = item ? getOverlayWidgetDefinition(item.type) : undefined;
  if (item && def && isRootOverlayDefinition(def) && def.getChildItems) {
    for (const ch of def.getChildItems(scene.items, id)) {
      ids.add(ch.id);
    }
  }
  return ids;
}

/** Build duplicate items (parent + synced children) for a root item. */
export function buildDuplicate(
  scene: OverlaySceneWithItems,
  id: string,
  maxZ: number
): { items: OverlayItem[]; parentId: string } | null {
  const original = scene.items.find((item) => item.id === id);
  if (!original || !isRootLayerType(original.type)) return null;

  const newParentId = nextTempId();
  const duplicateParent: OverlayItem = {
    ...original,
    id: newParentId,
    x: original.x + 20,
    y: original.y + 20,
    z_index: maxZ + 1,
    label: original.label + " (Copy)",
  };

  const newItems: OverlayItem[] = [duplicateParent];

  const origDef = getOverlayWidgetDefinition(original.type);
  if (isRootOverlayDefinition(origDef) && origDef.getChildItems) {
    const children = origDef.getChildItems(scene.items, id);
    for (const ch of children) {
      const cfg = asClipDisplayFieldConfig(ch.config);
      newItems.push({
        ...ch,
        id: nextTempId(),
        x: duplicateParent.x,
        y: duplicateParent.y,
        w: duplicateParent.w,
        h: duplicateParent.h,
        design_w: duplicateParent.design_w,
        design_h: duplicateParent.design_h,
        crop_top: duplicateParent.crop_top,
        crop_right: duplicateParent.crop_right,
        crop_bottom: duplicateParent.crop_bottom,
        crop_left: duplicateParent.crop_left,
        z_index: duplicateParent.z_index,
        config: {
          ...cfg,
          parentClipItemId: newParentId,
        },
      });
    }
  }

  return { items: newItems, parentId: newParentId };
}

/** Apply a top-first root ordering: contiguous z (top = count), clip children mirror parent z. */
export function applyLayerOrder(
  items: OverlayItem[],
  orderedIdsTopFirst: string[]
): OverlayItem[] {
  const zById = new Map<string, number>();
  orderedIdsTopFirst.forEach((id, idx) => {
    zById.set(id, orderedIdsTopFirst.length - idx);
  });

  return items.map((i) => {
    if (isRootLayerType(i.type)) {
      const z = zById.get(i.id);
      return z === undefined ? i : { ...i, z_index: z };
    }
    if (i.type === "clip_display_field") {
      const pid = asClipDisplayFieldConfig(i.config).parentClipItemId;
      const pz = zById.get(pid);
      return pz === undefined ? i : { ...i, z_index: pz };
    }
    return i;
  });
}

