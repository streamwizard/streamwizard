import { create } from "zustand";
import {
  getOverlayWidgetDefinition,
  isRootLayerType,
  isRootOverlayDefinition,
  OVERLAY_WIDGET_REGISTRY,
} from "@/components/overlays/registry/overlay-widget-registry";
import {
  MIN_ITEM_SIZE,
  applyLayerOrder,
  buildDuplicate,
  cascadeIds,
  clampGeometry,
  nextTempId,
  touchesGeometry,
} from "@/components/overlays/editor/overlay-item-helpers";
import type {
  DisplayFieldKey,
  OverlayItem,
  RootOverlayItemType,
  OverlaySceneWithItems,
} from "@/types/overlays";
import { asClipDisplayFieldConfig } from "@/types/overlays";

export type EditorMode = "simple" | "pro";

const EDITOR_MODE_STORAGE_KEY = "overlay-editor-mode";
const HISTORY_LIMIT = 50;
const NUDGE_HISTORY_COALESCE_MS = 400;

export { MIN_ITEM_SIZE };

function loadEditorMode(): EditorMode {
  if (typeof window === "undefined") return "simple";
  return window.localStorage.getItem(EDITOR_MODE_STORAGE_KEY) === "pro" ? "pro" : "simple";
}

interface OverlayEditorState {
  scene: OverlaySceneWithItems | null;
  selectedItemIds: string[];
  isDirty: boolean;
  zoom: number;
  /** Undo/redo snapshots of scene.items. Cleared on every setScene (save remaps temp ids). */
  history: { past: OverlayItem[][]; future: OverlayItem[][] };
  /** Set by the canvas context menu "Rename" — the inspector focuses its Label input, then clears it. */
  renameRequestId: string | null;
  /** Simple hides the layers panel and keeps the calm inspector defaults; pro is the full editor. */
  editorMode: EditorMode;
  setEditorMode: (mode: EditorMode) => void;

  setScene: (scene: OverlaySceneWithItems) => void;
  selectItem: (id: string | null) => void;
  toggleSelectItem: (id: string) => void;
  setSelectedItems: (ids: string[]) => void;
  clearSelection: () => void;
  selectClipDisplayFieldForEdit: (
    parentClipItemId: string,
    fieldKey: DisplayFieldKey
  ) => void;
  setZoom: (zoom: number) => void;
  markDirty: () => void;
  markClean: () => void;
  setRenameRequestId: (id: string | null) => void;

  pushHistory: (snapshot?: OverlayItem[]) => void;
  undo: () => void;
  redo: () => void;

  addItem: (type: RootOverlayItemType) => void;
  addCustomWidget: (widgetId: string) => void;
  updateItem: (id: string, updates: Partial<OverlayItem>) => void;
  removeItem: (id: string) => void;
  removeSelectedItems: () => void;
  duplicateItem: (id: string) => void;
  duplicateSelectedItems: () => void;
  nudgeSelected: (dx: number, dy: number) => void;
  reorderItem: (id: string, direction: "up" | "down") => void;
  setLayerOrder: (orderedIdsTopFirst: string[]) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  renameItem: (id: string, label: string) => void;
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

  /**
   * Demo mode: the last fake event pushed at the canvas's widget iframes.
   * Editor-session only -- never enters history and never marks the scene
   * dirty, same as the clip preview controls above.
   *
   * Consumers compare `seq` and nothing else; firing the same event twice must
   * still deliver twice, which an equality check on the payload wouldn't do.
   */
  demoEvent: { listener: string; event: Record<string, unknown>; seq: number } | null;
  emitDemoEvent: (listener: string, event: Record<string, unknown>) => void;
  /** Ids of the simulators currently looping, so the toolbar can badge a count. */
  runningSimulatorIds: string[];
  setRunningSimulatorIds: (ids: string[]) => void;
}

/** The single-selection id when exactly one item is selected; feeds legacy single-select consumers. */
export function selectPrimarySelectedId(s: Pick<OverlayEditorState, "selectedItemIds">): string | null {
  return s.selectedItemIds.length === 1 ? s.selectedItemIds[0]! : null;
}

let lastNudgeAt = 0;

export const useOverlayStore = create<OverlayEditorState>((set, get) => ({
  scene: null,
  selectedItemIds: [],
  isDirty: false,
  zoom: 0.5,
  history: { past: [], future: [] },
  renameRequestId: null,
  editorMode: loadEditorMode(),
  setEditorMode: (mode) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EDITOR_MODE_STORAGE_KEY, mode);
    }
    set({ editorMode: mode });
  },

  setScene: (scene) =>
    set({
      scene,
      isDirty: false,
      selectedItemIds: [],
      // Save remaps temp-N ids to DB ids; undoing across that boundary would
      // resurrect dead temp ids and duplicate rows on the next full-replace save.
      history: { past: [], future: [] },
    }),

  selectItem: (id) => set({ selectedItemIds: id === null ? [] : [id] }),

  toggleSelectItem: (id) => {
    const { scene, selectedItemIds } = get();
    const item = scene?.items.find((i) => i.id === id);
    if (!item) return;
    // Clip children never participate in multi-selection.
    if (!isRootLayerType(item.type)) {
      set({ selectedItemIds: [id] });
      return;
    }
    const onlyRoots = selectedItemIds.filter((sid) => {
      const s = scene!.items.find((i) => i.id === sid);
      return s && isRootLayerType(s.type);
    });
    set({
      selectedItemIds: onlyRoots.includes(id)
        ? onlyRoots.filter((sid) => sid !== id)
        : [...onlyRoots, id],
    });
  },

  setSelectedItems: (ids) => set({ selectedItemIds: ids }),

  clearSelection: () => set({ selectedItemIds: [] }),

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
    if (child) set({ selectedItemIds: [child.id] });
  },

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(2, zoom)) }),

  markDirty: () => set({ isDirty: true }),

  markClean: () => set({ isDirty: false }),

  setRenameRequestId: (id) => set({ renameRequestId: id }),

  pushHistory: (snapshot) => {
    const { scene, history } = get();
    const items = snapshot ?? scene?.items;
    if (!items) return;
    // Skip no-op pushes (e.g. focusing an input without editing) so undo never
    // appears to do nothing; items reference only changes when something mutated.
    if (history.past[history.past.length - 1] === items) return;
    const past = [...history.past, items].slice(-HISTORY_LIMIT);
    set({ history: { past, future: [] } });
  },

  undo: () => {
    const { scene, history, selectedItemIds } = get();
    if (!scene || history.past.length === 0) return;
    const previous = history.past[history.past.length - 1]!;
    const surviving = new Set(previous.map((i) => i.id));
    set({
      scene: { ...scene, items: previous },
      history: {
        past: history.past.slice(0, -1),
        future: [...history.future, scene.items],
      },
      selectedItemIds: selectedItemIds.filter((id) => surviving.has(id)),
      isDirty: true,
    });
  },

  redo: () => {
    const { scene, history, selectedItemIds } = get();
    if (!scene || history.future.length === 0) return;
    const next = history.future[history.future.length - 1]!;
    const surviving = new Set(next.map((i) => i.id));
    set({
      scene: { ...scene, items: next },
      history: {
        past: [...history.past, scene.items].slice(-HISTORY_LIMIT),
        future: history.future.slice(0, -1),
      },
      selectedItemIds: selectedItemIds.filter((id) => surviving.has(id)),
      isDirty: true,
    });
  },

  addItem: (type) => {
    const { scene, pushHistory } = get();
    if (!scene) return;

    const def = OVERLAY_WIDGET_REGISTRY[type];
    if (!def?.createRootItems) return;

    const maxZ = scene.items.reduce((max, item) => Math.max(max, item.z_index), 0);
    const newItems = def.createRootItems({ scene, nextId: nextTempId, maxZ });
    if (newItems.length === 0) return;

    pushHistory();
    set({
      scene: { ...scene, items: [...scene.items, ...newItems] },
      selectedItemIds: [newItems[0]!.id],
      isDirty: true,
    });
  },

  addCustomWidget: (widgetId) => {
    const { scene, pushHistory } = get();
    if (!scene) return;

    const def = OVERLAY_WIDGET_REGISTRY["custom_widget"];
    if (!def?.createRootItems) return;

    const maxZ = scene.items.reduce((max, item) => Math.max(max, item.z_index), 0);
    const newItems = def.createRootItems({ scene, nextId: nextTempId, maxZ });
    if (newItems.length === 0) return;

    // Patch the widget_id into the config immediately so the canvas renders it right away
    const item = { ...newItems[0]!, config: { ...newItems[0]!.config, widget_id: widgetId } };

    pushHistory();
    set({
      scene: { ...scene, items: [...scene.items, item] },
      selectedItemIds: [item.id],
      isDirty: true,
    });
  },

  updateItem: (id, updates) => {
    const { scene } = get();
    if (!scene) return;

    const target = scene.items.find((i) => i.id === id);
    if (!target) return;

    const nextUpdates = touchesGeometry(updates)
      ? clampGeometry(target, updates, scene)
      : updates;

    let nextItems = scene.items.map((item) =>
      item.id === id ? { ...item, ...nextUpdates } : item
    );

    const updated = nextItems.find((i) => i.id === id);
    const parentDef = updated ? getOverlayWidgetDefinition(updated.type) : undefined;
    if (
      parentDef &&
      isRootOverlayDefinition(parentDef) &&
      parentDef.syncChildGeometryFromParent &&
      (touchesGeometry(nextUpdates) || nextUpdates.z_index !== undefined)
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
          design_w: updated!.design_w,
          design_h: updated!.design_h,
          crop_top: updated!.crop_top,
          crop_right: updated!.crop_right,
          crop_bottom: updated!.crop_bottom,
          crop_left: updated!.crop_left,
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
    const { scene, selectedItemIds, pushHistory } = get();
    if (!scene) return;

    const idsToRemove = cascadeIds(scene, id);

    pushHistory();
    set({
      scene: {
        ...scene,
        items: scene.items.filter((i) => !idsToRemove.has(i.id)),
      },
      selectedItemIds: selectedItemIds.filter((sid) => !idsToRemove.has(sid)),
      isDirty: true,
    });
  },

  removeSelectedItems: () => {
    const { scene, selectedItemIds, pushHistory } = get();
    if (!scene || selectedItemIds.length === 0) return;

    // A selected clip child is "deleted" by hiding it (matches layers-panel semantics).
    const single =
      selectedItemIds.length === 1
        ? scene.items.find((i) => i.id === selectedItemIds[0])
        : undefined;
    if (single && !isRootLayerType(single.type)) {
      pushHistory();
      const parentId = asClipDisplayFieldConfig(single.config).parentClipItemId;
      set({
        scene: {
          ...scene,
          items: scene.items.map((i) =>
            i.id === single.id ? { ...i, is_visible: false } : i
          ),
        },
        selectedItemIds: parentId ? [parentId] : [],
        isDirty: true,
      });
      return;
    }

    const idsToRemove = new Set<string>();
    for (const id of selectedItemIds) {
      const item = scene.items.find((i) => i.id === id);
      if (!item || !isRootLayerType(item.type)) continue;
      for (const rid of cascadeIds(scene, id)) idsToRemove.add(rid);
    }
    if (idsToRemove.size === 0) return;

    pushHistory();
    set({
      scene: {
        ...scene,
        items: scene.items.filter((i) => !idsToRemove.has(i.id)),
      },
      selectedItemIds: [],
      isDirty: true,
    });
  },

  duplicateItem: (id) => {
    const { scene, pushHistory } = get();
    if (!scene) return;

    const maxZ = scene.items.reduce((max, item) => Math.max(max, item.z_index), 0);
    const dup = buildDuplicate(scene, id, maxZ);
    if (!dup) return;

    pushHistory();
    set({
      scene: { ...scene, items: [...scene.items, ...dup.items] },
      selectedItemIds: [dup.parentId],
      isDirty: true,
    });
  },

  duplicateSelectedItems: () => {
    const { scene, selectedItemIds, pushHistory } = get();
    if (!scene || selectedItemIds.length === 0) return;

    let items = scene.items;
    let maxZ = items.reduce((max, item) => Math.max(max, item.z_index), 0);
    const newSelection: string[] = [];
    const added: OverlayItem[] = [];

    for (const id of selectedItemIds) {
      const dup = buildDuplicate({ ...scene, items }, id, maxZ);
      if (!dup) continue;
      added.push(...dup.items);
      items = [...items, ...dup.items];
      newSelection.push(dup.parentId);
      maxZ += 1;
    }
    if (added.length === 0) return;

    pushHistory();
    set({
      scene: { ...scene, items },
      selectedItemIds: newSelection,
      isDirty: true,
    });
  },

  nudgeSelected: (dx, dy) => {
    const { scene, selectedItemIds, pushHistory, updateItem } = get();
    if (!scene || selectedItemIds.length === 0) return;

    const movable = selectedItemIds
      .map((id) => scene.items.find((i) => i.id === id))
      .filter(
        (i): i is OverlayItem =>
          !!i && isRootLayerType(i.type) && !i.is_locked
      );
    if (movable.length === 0) return;

    // Holding an arrow key produces one history entry per burst, not per press.
    const now = Date.now();
    if (now - lastNudgeAt > NUDGE_HISTORY_COALESCE_MS) {
      pushHistory();
    }
    lastNudgeAt = now;

    for (const item of movable) {
      updateItem(item.id, { x: item.x + dx, y: item.y + dy });
    }
  },

  reorderItem: (id, direction) => {
    const { scene, pushHistory } = get();
    if (!scene) return;

    const item = scene.items.find((i) => i.id === id);
    if (!item || !isRootLayerType(item.type)) return;

    const roots = scene.items
      .filter((i) => isRootLayerType(i.type))
      .sort((a, b) => b.z_index - a.z_index);
    const idx = roots.findIndex((r) => r.id === id);
    if (idx === -1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= roots.length) return;

    const order = roots.map((r) => r.id);
    [order[idx], order[swapIdx]] = [order[swapIdx]!, order[idx]!];

    pushHistory();
    set({
      scene: { ...scene, items: applyLayerOrder(scene.items, order) },
      isDirty: true,
    });
  },

  setLayerOrder: (orderedIdsTopFirst) => {
    const { scene, pushHistory } = get();
    if (!scene) return;

    pushHistory();
    set({
      scene: { ...scene, items: applyLayerOrder(scene.items, orderedIdsTopFirst) },
      isDirty: true,
    });
  },

  bringToFront: (id) => {
    const { scene, setLayerOrder } = get();
    if (!scene) return;
    const order = scene.items
      .filter((i) => isRootLayerType(i.type))
      .sort((a, b) => b.z_index - a.z_index)
      .map((i) => i.id)
      .filter((iid) => iid !== id);
    setLayerOrder([id, ...order]);
  },

  sendToBack: (id) => {
    const { scene, setLayerOrder } = get();
    if (!scene) return;
    const order = scene.items
      .filter((i) => isRootLayerType(i.type))
      .sort((a, b) => b.z_index - a.z_index)
      .map((i) => i.id)
      .filter((iid) => iid !== id);
    setLayerOrder([...order, id]);
  },

  renameItem: (id, label) => {
    const { scene, pushHistory } = get();
    if (!scene) return;
    pushHistory();
    set({
      scene: {
        ...scene,
        items: scene.items.map((i) => (i.id === id ? { ...i, label } : i)),
      },
      isDirty: true,
    });
  },

  toggleItemVisibility: (id) => {
    const { scene, pushHistory } = get();
    if (!scene) return;

    pushHistory();
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
    const { scene, pushHistory } = get();
    if (!scene) return;

    pushHistory();
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

  demoEvent: null,
  emitDemoEvent: (listener, event) =>
    set((s) => ({
      demoEvent: { listener, event, seq: (s.demoEvent?.seq ?? 0) + 1 },
    })),

  runningSimulatorIds: [],
  setRunningSimulatorIds: (ids) => set({ runningSimulatorIds: ids }),
}));
