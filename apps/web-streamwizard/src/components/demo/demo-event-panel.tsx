"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Play, Square } from "lucide-react";
import {
  DEMO_EVENTS,
  DEMO_EVENT_DEFS,
  DEMO_EVENT_TYPES,
  isDemoEventType,
  type DemoEventType,
} from "@repo/schemas";
import { WIDGET_SIMULATORS, scanWidgetListeners } from "@repo/ui/overlay";
import { sendTestEventToOverlay } from "@/actions/overlay-test-alert";
import { Button, Textarea } from "@repo/ui";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";

/** Kept on the bar itself — the events most widgets are actually built around. */
const PINNED: DemoEventType[] = [
  "channel.follow",
  "channel.subscribe",
  "channel.cheer",
  "channel.raid",
];

/**
 * Below this, a Live simulator is more round trips than the server action
 * should take. Local has no such cost, so the cap only applies to Live.
 */
const MIN_LIVE_INTERVAL_MS = 1000;

/** Picker group holding the events the widget's own source references. */
const USED_GROUP = "Used by this widget";

type FireMode = "local" | "live";

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

function readSaved(storageId: string): {
  type: DemoEventType;
  payload: string;
  edited: boolean;
} {
  const fallback = {
    type: "channel.follow" as DemoEventType,
    payload: prettyPayload("channel.follow"),
    edited: false,
  };
  try {
    const raw =
      localStorage.getItem(storageKey(storageId)) ??
      localStorage.getItem(legacyStorageKey(storageId));
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as { type?: string; payload?: string };
    if (!saved.type || !isDemoEventType(saved.type)) return fallback;
    return {
      type: saved.type,
      payload: saved.payload ?? prettyPayload(saved.type),
      edited: Boolean(saved.payload),
    };
  } catch {
    // corrupt or unavailable storage — start clean
    return fallback;
  }
}

export interface DemoEventPanelProps {
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
   * The widget's JS, used to lead the picker with the events it actually
   * handles. The overlay editor joins every custom widget on the canvas.
   * Omit it and the full catalogue shows flat.
   */
  sourceJs?: string;
  /** Local delivery sink: straight into the preview iframe(s), no server round-trip. */
  onFireLocal: (listener: string, event: Record<string, unknown>) => void;
  /** Reported so the host can badge its toolbar while simulators loop. */
  onRunningSimulatorsChange?: (ids: string[]) => void;
  className?: string;
}

export function DemoEventPanel({
  storageId,
  sourceJs,
  wsConnected,
  onFireLocal,
  onRunningSimulatorsChange,
  className,
}: DemoEventPanelProps) {
  const [saved] = useState(() => readSaved(storageId));
  const [mode, setMode] = useState<FireMode>("local");
  const [selected, setSelected] = useState<DemoEventType>(saved.type);
  const [payloadOpen, setPayloadOpen] = useState(false);
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
        JSON.stringify({ type: selected, payload: payloadEdited ? payloadText : undefined })
      );
    } catch {
      // storage full or blocked — persistence is a nicety, not a requirement
    }
  }, [storageId, selected, payloadEdited, payloadText]);

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
  const effectiveMode: FireMode = liveAvailable ? mode : "local";

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

  /** The payload for `type`: the author's edit if it applies, otherwise a fresh fixture. */
  function resolvePayload(type: DemoEventType, variant?: string): Record<string, unknown> | null {
    // A variant is a different payload for the same listener, so an edit made
    // against the default doesn't apply to it.
    if (variant) {
      const build = DEMO_EVENT_DEFS[type].variants?.[variant]?.build;
      return build ? build() : null;
    }
    if (type !== selected || !payloadEdited) {
      return DEMO_EVENTS[type].build();
    }
    try {
      const parsed = JSON.parse(payloadText) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        toast.error("Payload must be a JSON object");
        return null;
      }
      return parsed as Record<string, unknown>;
    } catch {
      toast.error("Payload isn't valid JSON");
      return null;
    }
  }

  function fire(type: DemoEventType, variant?: string) {
    const payload = resolvePayload(type, variant);
    if (!payload) return;

    if (effectiveMode === "local") {
      onFireLocal(type, payload);
      return;
    }

    startSend(async () => {
      // Anything that isn't the untouched default has to travel as a custom
      // payload -- the server rebuilds the default otherwise.
      const custom = variant || (type === selected && payloadEdited) ? payload : undefined;
      const { ok, error } = await sendTestEventToOverlay(type, custom);
      if (!ok) toast.error(error ?? "Could not send the demo event");
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

    const live = effectiveMode === "live";
    const stop = def.start((listener, event) => {
      if (!live) {
        onFireLocal(listener, event);
        return;
      }
      if (!isDemoEventType(listener)) return;
      void sendTestEventToOverlay(listener, event).then(({ ok, error }) => {
        if (ok) return;
        // A rejected tick means every following tick is rejected too (rate
        // limit, lost server) -- stop rather than log once a second.
        toast.error(error ?? "Demo simulator stopped");
        stopSimulator(id);
      });
    });

    stopFnsRef.current.set(id, stop);
    setRunningIds((ids) => [...ids, id]);
  }

  return (
    <div className={`shrink-0 border-b bg-background ${className ?? ""}`}>
      <div className="px-3 py-1.5 flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-muted-foreground mr-1 shrink-0">Demo:</span>

        {PINNED.map((type) => (
          <Button
            key={type}
            size="sm"
            variant="outline"
            className="h-6 text-[11px] px-2"
            disabled={isSending}
            onClick={() => fire(type)}
          >
            {DEMO_EVENTS[type].label}
          </Button>
        ))}

        <Select value={selected} onValueChange={(v) => selectType(v as DemoEventType)}>
          <SelectTrigger className="h-6 text-[11px] w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {grouped.map(([group, types]) => (
              <SelectGroup key={group}>
                <SelectLabel className="text-[10px]">{group}</SelectLabel>
                {types.map((type) => (
                  <SelectItem key={type} value={type} className="text-xs">
                    {DEMO_EVENTS[type].label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          className="h-6 text-[11px] px-2"
          disabled={isSending}
          onClick={() => fire(selected)}
        >
          Fire
        </Button>

        {variants.map(([key, variant]) => (
          <Button
            key={key}
            size="sm"
            variant="outline"
            className="h-6 text-[11px] px-2"
            disabled={isSending}
            onClick={() => fire(selected, key)}
          >
            {variant.label}
          </Button>
        ))}

        <button
          type="button"
          onClick={() => setPayloadOpen((v) => !v)}
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {payloadOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Payload{payloadEdited ? " (edited)" : ""}
        </button>

        {/* Local posts into the iframe; Live goes out over ws-server so the real
            delivery path — and every other open overlay — is exercised too. */}
        <div className="ml-auto flex items-center rounded-md border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("local")}
            className={`text-[11px] px-2 py-0.5 transition-colors ${
              effectiveMode === "local" ? "bg-accent text-foreground" : "text-muted-foreground"
            }`}
          >
            Local
          </button>
          <button
            type="button"
            onClick={() => setMode("live")}
            disabled={!liveAvailable}
            title={
              liveAvailable
                ? "Send through the overlay server to every overlay you have open"
                : "Connect to live events first — Live sends through the overlay server"
            }
            className={`text-[11px] px-2 py-0.5 transition-colors disabled:opacity-40 ${
              effectiveMode === "live" ? "bg-accent text-foreground" : "text-muted-foreground"
            }`}
          >
            Live
          </button>
        </div>
      </div>

      {/* Looping sources. A one-shot shows what an event looks like; these show
          what the widget looks like while data keeps arriving. */}
      <div className="px-3 pb-1.5 flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-muted-foreground mr-1 shrink-0">Simulate:</span>
        {Object.values(WIDGET_SIMULATORS).map((def) => {
          const running = runningIds.includes(def.id);
          const tooFastForLive =
            effectiveMode === "live" && def.defaultIntervalMs < MIN_LIVE_INTERVAL_MS;
          return (
            <Button
              key={def.id}
              size="sm"
              variant={running ? "secondary" : "outline"}
              className="h-6 text-[11px] px-2"
              disabled={tooFastForLive && !running}
              title={
                tooFastForLive
                  ? "Too frequent to send live — switch to Local"
                  : def.description
              }
              onClick={() => (running ? stopSimulator(def.id) : startSimulator(def.id))}
            >
              {running ? (
                <Square className="mr-1 h-2.5 w-2.5" />
              ) : (
                <Play className="mr-1 h-2.5 w-2.5" />
              )}
              {def.label}
            </Button>
          );
        })}
        {runningIds.length > 0 && effectiveMode === "live" && (
          <span className="text-[10px] text-muted-foreground">
            Going to every overlay you have open
          </span>
        )}
      </div>

      {payloadOpen && (
        <div className="px-3 pb-2 space-y-1.5">
          <Textarea
            value={payloadText}
            onChange={(e) => {
              setPayloadText(e.target.value);
              setPayloadEdited(true);
            }}
            rows={8}
            spellCheck={false}
            className="font-mono text-[11px] leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[11px]"
              onClick={() => selectType(selected)}
            >
              Reset payload
            </Button>
            <span className="text-[10px] text-muted-foreground">
              Edits apply to {DEMO_EVENTS[selected].label} only.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
