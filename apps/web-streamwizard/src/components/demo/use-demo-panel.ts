"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  DEMO_EVENTS,
  DEMO_EVENT_DEFS,
  DEMO_EVENT_TYPES,
  isDemoEventType,
  type DemoEventType,
} from "@repo/schemas";
import { WIDGET_SIMULATORS, scanWidgetListeners } from "@repo/ui/overlay";
import type { DemoFireRequest, FireMode } from "./demo-fire";

/**
 * Below this, a Live simulator is more round trips than the server action
 * should take. Local has no such cost, so the cap only applies to Live.
 */
export const MIN_LIVE_INTERVAL_MS = 1000;

/** Picker group holding the events the widget's own source references. */
const USED_GROUP = "Used by this widget";

function storageKey(storageId: string) {
  return `sw:demo-panel:${storageId}`;
}

/** The widget editor's old key, read once so saved payloads survive the rename. */
function legacyStorageKey(storageId: string) {
  return `sw:widget-editor:test-event:${storageId}`;
}

function prettyPayload(type: DemoEventType) {
  return JSON.stringify(DEMO_EVENTS[type].build(), null, 2);
}

interface SavedState {
  type: DemoEventType;
  payload: string;
  edited: boolean;
  tab?: string;
}

function readSaved(storageId: string): SavedState {
  const fallback: SavedState = {
    type: "channel.follow",
    payload: prettyPayload("channel.follow"),
    edited: false,
  };
  try {
    const raw =
      localStorage.getItem(storageKey(storageId)) ??
      localStorage.getItem(legacyStorageKey(storageId));
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as { type?: string; payload?: string; tab?: string };
    if (!saved.type || !isDemoEventType(saved.type)) return fallback;
    return {
      type: saved.type,
      payload: saved.payload ?? prettyPayload(saved.type),
      edited: Boolean(saved.payload),
      tab: typeof saved.tab === "string" ? saved.tab : undefined,
    };
  } catch {
    // corrupt or unavailable storage — start clean
    return fallback;
  }
}

export interface UseDemoPanelOptions {
  /** Namespaces localStorage. Widget id in the widget editor, scene id in the overlay editor. */
  storageId: string;
  /**
   * Live-mode gate. A boolean means the caller owns a socket and Live should
   * follow it; `undefined` means Live is always offered, which is right for
   * hosts with no socket of their own -- delivery goes through the server
   * action, not the caller's connection.
   */
  wsConnected?: boolean;
  /**
   * Controlled fire mode. A host that owns one switch for the whole live story
   * (the widget editor) passes the mode alone and the panel's toggle
   * disappears. A host that shares the mode with other panels (the overlay
   * editor, whose alert inspector fires through it too) passes `onModeChange`
   * as well and keeps the toggle. Omitted, the panel owns the mode itself.
   */
  mode?: FireMode;
  /** Makes a controlled `mode` writable, so the panel keeps its toggle. */
  onModeChange?: (mode: FireMode) => void;
  /**
   * The widget's JS, used to lead the picker with the events it actually
   * handles. The overlay editor joins every custom widget on the canvas.
   * Omit it and the full catalogue shows flat.
   */
  sourceJs?: string;
  /**
   * Delivery. The panel picks the event; the host decides where it goes, since
   * only the host knows what it is previewing into. It is handed the request,
   * not a built payload, so a Live fire can let the server rebuild the fixture.
   */
  onFire: (request: DemoFireRequest) => Promise<boolean>;
  /** Reported so the host can badge its toolbar while simulators loop. */
  onRunningSimulatorsChange?: (ids: string[]) => void;
}

/**
 * Everything the demo surfaces share: the Local/Live story, the event picker
 * and its payload, and the looping simulators. The layouts (the overlay
 * editor's floating deck, the widget editor's strip) only arrange it.
 */
export function useDemoPanel({
  storageId,
  sourceJs,
  wsConnected,
  mode: controlledMode,
  onModeChange,
  onFire,
  onRunningSimulatorsChange,
}: UseDemoPanelOptions) {
  const [saved] = useState(() => readSaved(storageId));
  const [mode, setMode] = useState<FireMode>("local");
  const [selected, setSelected] = useState<DemoEventType>(saved.type);
  const [tab, setTab] = useState<string | undefined>(saved.tab);
  const [payloadText, setPayloadText] = useState(saved.payload);
  /** Untouched payloads are rebuilt per fire so timestamps and ids stay fresh. */
  const [payloadEdited, setPayloadEdited] = useState(saved.edited);
  const [isSending, startSend] = useTransition();
  const [runningIds, setRunningIds] = useState<string[]>([]);

  // Stop functions for the simulators currently looping. In a ref because the
  // cleanup below must reach the live set, not the set captured at mount.
  const stopFnsRef = useRef(new Map<string, () => void>());

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey(storageId),
        JSON.stringify({ type: selected, payload: payloadEdited ? payloadText : undefined, tab })
      );
    } catch {
      // storage full or blocked — persistence is a nicety, not a requirement
    }
  }, [storageId, selected, payloadEdited, payloadText, tab]);

  // A simulator that outlives the editor keeps firing at nothing forever.
  useEffect(() => {
    const stopFns = stopFnsRef.current;
    return () => {
      for (const stop of stopFns.values()) stop();
      stopFns.clear();
    };
  }, []);

  useEffect(() => {
    onRunningSimulatorsChange?.(runningIds);
    // The callback is usually an inline arrow; depending on it would re-run
    // this on every render of the host.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningIds]);

  // Derived, not stored: losing the socket mid-session must fall back to Local
  // without clobbering the author's choice for when it reconnects.
  const liveAvailable = wsConnected === undefined || wsConnected;
  const effectiveMode: FireMode = liveAvailable ? (controlledMode ?? mode) : "local";
  // A controlled mode with no setter belongs to the host's own switch, so the
  // panel shows none. With a setter, the mode is shared and the panel drives it.
  const changeMode = onModeChange ?? (controlledMode === undefined ? setMode : null);

  /**
   * Reading the widget's own source is enough to tell which events it handles,
   * which beats making a streamer guess from a list of seventy. Cheap enough to
   * redo as an author types in the widget editor.
   */
  const scan = useMemo(
    () => (sourceJs ? scanWidgetListeners(sourceJs, DEMO_EVENT_TYPES) : null),
    [sourceJs]
  );

  const detected = useMemo(() => {
    if (!scan?.confident) return [];
    return scan.listeners.filter(isDemoEventType);
  }, [scan]);

  const grouped = useMemo(() => {
    const out = new Map<string, DemoEventType[]>();
    // Detected events lead in their own group and are listed once -- a value
    // repeated across two SelectGroups confuses Radix's selection. Nothing is
    // ever removed: a scan that misses a computed listener string costs sort
    // order, not access.
    const promoted = new Set(detected);
    if (detected.length > 0) out.set(USED_GROUP, detected);
    for (const type of DEMO_EVENT_TYPES) {
      if (promoted.has(type)) continue;
      const group = DEMO_EVENTS[type].group;
      out.set(group, [...(out.get(group) ?? []), type]);
    }
    return [...out.entries()];
  }, [detected]);

  const variants = useMemo(() => {
    const defined = DEMO_EVENT_DEFS[selected].variants;
    return defined ? Object.entries(defined) : [];
  }, [selected]);

  function selectType(type: DemoEventType) {
    setSelected(type);
    setPayloadText(prettyPayload(type));
    setPayloadEdited(false);
  }

  function editPayload(text: string) {
    setPayloadText(text);
    setPayloadEdited(true);
  }

  /**
   * The author's edited payload when it applies to this fire, otherwise
   * undefined so the fixture gets rebuilt fresh (ids, timestamps) at delivery.
   * `false` means the edit is there but unusable, which stops the fire.
   */
  function resolveCustom(
    type: DemoEventType,
    variant?: string
  ): Record<string, unknown> | undefined | false {
    // A variant is a different payload for the same listener, so an edit made
    // against the default doesn't apply to it.
    if (variant || type !== selected || !payloadEdited) return undefined;
    try {
      const parsed = JSON.parse(payloadText) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        toast.error("Payload must be a JSON object");
        return false;
      }
      return parsed as Record<string, unknown>;
    } catch {
      toast.error("Payload isn't valid JSON");
      return false;
    }
  }

  function fire(type: DemoEventType, variant?: string) {
    const custom = resolveCustom(type, variant);
    if (custom === false) return;
    startSend(async () => {
      await onFire({ type, variant, custom });
    });
  }

  /** A one-off with a payload the caller built itself (the ad break lengths). */
  function fireWith(type: DemoEventType, custom: Record<string, unknown>) {
    startSend(async () => {
      await onFire({ type, custom });
    });
  }

  function stopSimulator(id: string) {
    stopFnsRef.current.get(id)?.();
    stopFnsRef.current.delete(id);
    setRunningIds((ids) => ids.filter((i) => i !== id));
  }

  function startSimulator(id: string) {
    const def = WIDGET_SIMULATORS[id];
    if (!def || stopFnsRef.current.has(id)) return;

    const stop = def.start((listener, event) => {
      // A simulator builds its own payload each tick, so it always travels as a
      // custom one rather than being rebuilt at the far end.
      if (!isDemoEventType(listener)) return;
      void onFire({ type: listener, custom: event }).then((ok) => {
        // Once delivery starts failing every following tick fails too, so stop
        // rather than log once a second.
        if (!ok) stopSimulator(id);
      });
    });

    stopFnsRef.current.set(id, stop);
    setRunningIds((ids) => [...ids, id]);
  }

  return {
    storageId,
    effectiveMode,
    liveAvailable,
    changeMode,
    isSending,
    fire,
    fireWith,
    selected,
    selectType,
    grouped,
    variants,
    detected,
    payloadText,
    payloadEdited,
    editPayload,
    runningIds,
    startSimulator,
    stopSimulator,
    tab,
    setTab,
  };
}

export type DemoPanel = ReturnType<typeof useDemoPanel>;
