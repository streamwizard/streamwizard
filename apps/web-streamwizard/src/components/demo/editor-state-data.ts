"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { EditorStateWrite } from "@repo/ui/overlay";

/**
 * What custom widgets "saved" while previewing. In the editor a widget reads
 * the real StreamWizard.state / userState values, but its writes land here
 * instead of the real store, so testing never changes what the stream shows.
 * The streamer can also type values in through the demo panel.
 *
 * Kept per scene (per widget in the widget editor) in localStorage, and never
 * sent anywhere.
 */
export interface EditorStateData {
  /** Channel values. null means the key was deleted in the editor. */
  userState: Record<string, unknown>;
  /** Each placed widget's own blob, by overlay item id. */
  widgetState: Record<string, Record<string, unknown>>;
}

/** The widget editor previews one widget, so its blob sits under this id. */
export const PREVIEW_ITEM_ID = "preview";

/** Same rule as the real user-state route, so a key that works here works live. */
export const USER_STATE_KEY_PATTERN = /^[a-z0-9_]{1,64}$/;

const EMPTY: EditorStateData = { userState: {}, widgetState: {} };

function storageKey(storageId: string) {
  return `sw:demo-state:${storageId}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseEditorStateData(raw: string | null): EditorStateData {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return EMPTY;
    const widgetState: EditorStateData["widgetState"] = {};
    if (isPlainObject(parsed.widgetState)) {
      for (const [id, blob] of Object.entries(parsed.widgetState)) {
        if (isPlainObject(blob)) widgetState[id] = blob;
      }
    }
    return {
      userState: isPlainObject(parsed.userState) ? parsed.userState : {},
      widgetState,
    };
  } catch {
    return EMPTY;
  }
}

/** Folds a widget's write into the data. `itemId` is the widget that wrote it. */
export function applyEditorStateWrite(
  data: EditorStateData,
  itemId: string,
  write: EditorStateWrite
): EditorStateData {
  if (write.scope === "widget") {
    return { ...data, widgetState: { ...data.widgetState, [itemId]: write.value } };
  }
  return { ...data, userState: { ...data.userState, [write.key]: write.value } };
}

export function isEditorStateEmpty(data: EditorStateData) {
  return Object.keys(data.userState).length === 0 && Object.keys(data.widgetState).length === 0;
}

// One copy per storage id, shared by the canvas widgets and the demo panel.
const cache = new Map<string, EditorStateData>();
const listeners = new Map<string, Set<() => void>>();

function read(storageId: string): EditorStateData {
  let data = cache.get(storageId);
  if (!data) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(storageKey(storageId));
    } catch {
      // storage blocked — start clean
    }
    data = parseEditorStateData(raw);
    cache.set(storageId, data);
  }
  return data;
}

export function updateEditorStateData(
  storageId: string,
  update: (data: EditorStateData) => EditorStateData
) {
  const next = update(read(storageId));
  cache.set(storageId, next);
  try {
    if (isEditorStateEmpty(next)) localStorage.removeItem(storageKey(storageId));
    else localStorage.setItem(storageKey(storageId), JSON.stringify(next));
  } catch {
    // storage full or blocked — the values still apply for this session
  }
  for (const listener of listeners.get(storageId) ?? []) listener();
}

export function useEditorStateData(storageId: string) {
  const subscribe = useCallback(
    (listener: () => void) => {
      let set = listeners.get(storageId);
      if (!set) listeners.set(storageId, (set = new Set()));
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
    [storageId]
  );
  const getSnapshot = useCallback(() => read(storageId), [storageId]);
  const data = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const update = useCallback(
    (fn: (data: EditorStateData) => EditorStateData) => updateEditorStateData(storageId, fn),
    [storageId]
  );
  return [data, update] as const;
}
