import { create } from "zustand";
import {
  getOverlayWidgetDefinition,
  isRootLayerType,
  isRootOverlayDefinition,
  OVERLAY_WIDGET_REGISTRY,
} from "@/components/overlays/registry/overlay-widget-registry";
import type {
  DisplayFieldKey,
  OverlayItem,
  RootOverlayItemType,
  OverlaySceneWithItems,
} from "@/types/overlays";
import { asClipDisplayFieldConfig } from "@/types/overlays";

interface OverlayEditorState {
  scene: OverlaySceneWithItems | null;
  selectedItemId: string | null;
  isDirty: boolean;
  zoom: number;

  setScene: (scene: OverlaySceneWithItems) => void;
  selectItem: (id: string | null) => void;
  selectClipDisplayFieldForEdit: (
    parentClipItemId: string,
    fieldKey: DisplayFieldKey
  ) => void;
  setZoom: (zoom: number) => void;
  markDirty: () => void;
  markClean: () => void;

  addItem: (type: RootOverlayItemType) => void;
  addCustomWidget: (widgetId: string) => void;
  updateItem: (id: string, updates: Partial<OverlayItem>) => void;
  removeItem: (id: string) => void;
  duplicateItem: (id: string) => void;
  reorderItem: (id: string, direction: "up" | "down") => void;
  toggleItemVisibility: (id: string) => void;
  toggleItemLock: (id: string) => void;

  /** Editor-only: optional clip preview controls (pause / force-mute / autoplay), not persisted. */
  editorClipPreviewPaused: boolean;
  setEditorClipPreviewPaused: (paused: boolean) => void;
  editorClipPreviewForceMute: boolean;
  setEditorClipPreviewForceMute: (forceMute: boolean) => void;
  editorClipPreviewAutoplayBlocked: boolean;
  setEditorClipPreviewAutoplayBlocked: (blocked: boolean) => void;
  editorClipPreviewResumeTick: number;
  bumpEditorClipPreviewResume: () => void;
  attemptEditorClipPreviewUnblock: () => void;
}

let tempIdCounter = 0;

function nextTempId(): string {
  tempIdCounter++;
  return `temp-${tempIdCounter}`;
}

export const useOverlayStore = create<OverlayEditorState>((set, get) => ({
  scene: null,
  selectedItemId: null,
  isDirty: false,
  zoom: 0.5,

  setScene: (scene) =>
    set({
      scene,
      isDirty: false,
      selectedItemId: null,
    }),

  selectItem: (id) => set({ selectedItemId: id }),

  selectClipDisplayFieldForEdit: (parentClipItemId, fieldKey) => {
    const { scene } = get();
    if (!scene) return;
    const child = scene.items.find(
      (i) =>
        i.type === "clip_display_field" &&
        asClipDisplayFieldConfig(i.config).parentClipItemId ===
          parentClipItemId &&
        asClipDisplayFieldConfig(i.config).fieldKey === fieldKey
    );
    if (child) set({ selectedItemId: child.id });
  },

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(2, zoom)) }),

  markDirty: () => set({ isDirty: true }),

  markClean: () => set({ isDirty: false }),

  addItem: (type) => {
    const { scene } = get();
    if (!scene) return;

    const def = OVERLAY_WIDGET_REGISTRY[type];
    if (!def?.createRootItems) return;

    const maxZ = scene.items.reduce((max, item) => Math.max(max, item.z_index), 0);
    const newItems = def.createRootItems({ scene, nextId: nextTempId, maxZ });
    if (newItems.length === 0) return;

    set({
      scene: { ...scene, items: [...scene.items, ...newItems] },
      selectedItemId: newItems[0]!.id,
      isDirty: true,
    });
  },

  addCustomWidget: (widgetId) => {
    const { scene } = get();
    if (!scene) return;

    const def = OVERLAY_WIDGET_REGISTRY["custom_widget"];
    if (!def?.createRootItems) return;

    const maxZ = scene.items.reduce((max, item) => Math.max(max, item.z_index), 0);
    const newItems = def.createRootItems({ scene, nextId: nextTempId, maxZ });
    if (newItems.length === 0) return;

    // Patch the widget_id into the config immediately so the canvas renders it right away
    const item = { ...newItems[0]!, config: { ...newItems[0]!.config, widget_id: widgetId } };

    set({
      scene: { ...scene, items: [...scene.items, item] },
      selectedItemId: item.id,
      isDirty: true,
    });
  },

  updateItem: (id, updates) => {
    const { scene } = get();
    if (!scene) return;

    let nextItems = scene.items.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );

    const updated = nextItems.find((i) => i.id === id);
    const parentDef = updated ? getOverlayWidgetDefinition(updated.type) : undefined;
    if (
      parentDef &&
      isRootOverlayDefinition(parentDef) &&
      parentDef.syncChildGeometryFromParent &&
      (updates.x !== undefined ||
        updates.y !== undefined ||
        updates.w !== undefined ||
        updates.h !== undefined ||
        updates.z_index !== undefined)
    ) {
      nextItems = nextItems.map((ch) => {
        if (ch.type !== "clip_display_field") return ch;
        if (asClipDisplayFieldConfig(ch.config).parentClipItemId !== id) return ch;
        return {
          ...ch,
          x: updated!.x,
          y: updated!.y,
          w: updated!.w,
          h: updated!.h,
          z_index: updated!.z_index,
        };
      });
    }

    set({
      scene: { ...scene, items: nextItems },
      isDirty: true,
    });
  },

  removeItem: (id) => {
    const { scene, selectedItemId } = get();
    if (!scene) return;

    const item = scene.items.find((i) => i.id === id);
    const idsToRemove = new Set<string>([id]);
    const def = item ? getOverlayWidgetDefinition(item.type) : undefined;
    if (item && def && isRootOverlayDefinition(def) && def.getChildItems) {
      for (const ch of def.getChildItems(scene.items, id)) {
        idsToRemove.add(ch.id);
      }
    }

    set({
      scene: {
        ...scene,
        items: scene.items.filter((i) => !idsToRemove.has(i.id)),
      },
      selectedItemId:
        selectedItemId && idsToRemove.has(selectedItemId)
          ? null
          : selectedItemId,
      isDirty: true,
    });
  },

  duplicateItem: (id) => {
    const { scene } = get();
    if (!scene) return;

    const original = scene.items.find((item) => item.id === id);
    if (!original || !isRootLayerType(original.type)) return;

    const maxZ = scene.items.reduce((max, item) => Math.max(max, item.z_index), 0);

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
          z_index: duplicateParent.z_index,
          config: {
            ...cfg,
            parentClipItemId: newParentId,
          },
        });
      }
    }

    set({
      scene: { ...scene, items: [...scene.items, ...newItems] },
      selectedItemId: duplicateParent.id,
      isDirty: true,
    });
  },

  reorderItem: (id, direction) => {
    const { scene } = get();
    if (!scene) return;

    const item = scene.items.find((i) => i.id === id);
    if (!item || !isRootLayerType(item.type)) return;

    const roots = scene.items
      .filter((i) => isRootLayerType(i.type))
      .sort((a, b) => a.z_index - b.z_index);
    const idx = roots.findIndex((item) => item.id === id);
    if (idx === -1) return;

    const swapIdx = direction === "up" ? idx + 1 : idx - 1;
    if (swapIdx < 0 || swapIdx >= roots.length) return;

    const tempZ = roots[idx].z_index;
    roots[idx] = { ...roots[idx], z_index: roots[swapIdx].z_index };
    roots[swapIdx] = { ...roots[swapIdx], z_index: tempZ };

    const zById = new Map(roots.map((r) => [r.id, r.z_index]));
    const nextItems = scene.items.map((i) => {
      const z = zById.get(i.id);
      if (z === undefined) return i;
      const next = { ...i, z_index: z };
      if (isRootLayerType(i.type)) {
        return next;
      }
      if (i.type === "clip_display_field") {
        const pid = asClipDisplayFieldConfig(i.config).parentClipItemId;
        const pz = zById.get(pid);
        if (pz === undefined) return next;
        return { ...next, z_index: pz };
      }
      return next;
    });

    set({
      scene: { ...scene, items: nextItems },
      isDirty: true,
    });
  },

  toggleItemVisibility: (id) => {
    const { scene } = get();
    if (!scene) return;

    set({
      scene: {
        ...scene,
        items: scene.items.map((item) =>
          item.id === id ? { ...item, is_visible: !item.is_visible } : item
        ),
      },
      isDirty: true,
    });
  },

  toggleItemLock: (id) => {
    const { scene } = get();
    if (!scene) return;

    set({
      scene: {
        ...scene,
        items: scene.items.map((item) =>
          item.id === id ? { ...item, is_locked: !item.is_locked } : item
        ),
      },
      isDirty: true,
    });
  },

  editorClipPreviewPaused: false,
  setEditorClipPreviewPaused: (paused) =>
    set({
      editorClipPreviewPaused: paused,
      ...(!paused ? { editorClipPreviewAutoplayBlocked: false } : {}),
    }),

  editorClipPreviewForceMute: false,
  setEditorClipPreviewForceMute: (forceMute) =>
    set({ editorClipPreviewForceMute: forceMute }),

  editorClipPreviewAutoplayBlocked: false,
  setEditorClipPreviewAutoplayBlocked: (blocked) =>
    set({ editorClipPreviewAutoplayBlocked: blocked }),

  editorClipPreviewResumeTick: 0,
  bumpEditorClipPreviewResume: () =>
    set((s) => ({ editorClipPreviewResumeTick: s.editorClipPreviewResumeTick + 1 })),

  attemptEditorClipPreviewUnblock: () =>
    set((s) => ({
      editorClipPreviewAutoplayBlocked: false,
      editorClipPreviewPaused: false,
      editorClipPreviewResumeTick: s.editorClipPreviewResumeTick + 1,
    })),
}));
