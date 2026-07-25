"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  WIDGET_TEST_EVENTS,
  WIDGET_TEST_EVENT_TYPES,
  isWidgetTestEventType,
  type WidgetTestEventType,
} from "@repo/schemas";
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
const PINNED: WidgetTestEventType[] = [
  "channel.follow",
  "channel.subscribe",
  "channel.cheer",
  "channel.raid",
];

type FireMode = "local" | "live";

function storageKey(widgetId: string) {
  return `sw:widget-editor:test-event:${widgetId}`;
}

function prettyPayload(type: WidgetTestEventType) {
  return JSON.stringify(WIDGET_TEST_EVENTS[type].build(), null, 2);
}

export function WidgetTestEventPanel({
  widgetId,
  wsConnected,
  onFireLocal,
}: {
  widgetId: string;
  wsConnected: boolean;
  /** Posts straight into the preview iframe — no server round-trip. */
  onFireLocal: (listener: string, event: Record<string, unknown>) => void;
}) {
  const [mode, setMode] = useState<FireMode>("local");
  const [selected, setSelected] = useState<WidgetTestEventType>("channel.follow");
  const [payloadOpen, setPayloadOpen] = useState(false);
  const [payloadText, setPayloadText] = useState(() => prettyPayload("channel.follow"));
  /** Untouched payloads are rebuilt per fire so timestamps and ids stay fresh. */
  const [payloadEdited, setPayloadEdited] = useState(false);
  const [isSending, startSend] = useTransition();

  // Restore the last event the author was working with for this widget.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(widgetId));
      if (!raw) return;
      const saved = JSON.parse(raw) as { type?: string; payload?: string };
      if (saved.type && isWidgetTestEventType(saved.type)) {
        setSelected(saved.type);
        setPayloadText(saved.payload ?? prettyPayload(saved.type));
        setPayloadEdited(Boolean(saved.payload));
      }
    } catch {
      // corrupt or unavailable storage — fall back to defaults
    }
  }, [widgetId]);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey(widgetId),
        JSON.stringify({ type: selected, payload: payloadEdited ? payloadText : undefined })
      );
    } catch {
      // storage full or blocked — persistence is a nicety, not a requirement
    }
  }, [widgetId, selected, payloadEdited, payloadText]);

  // Losing the socket mid-session would leave Live selected but unverifiable.
  useEffect(() => {
    if (!wsConnected) setMode("local");
  }, [wsConnected]);

  const grouped = useMemo(() => {
    const out = new Map<string, WidgetTestEventType[]>();
    for (const type of WIDGET_TEST_EVENT_TYPES) {
      const group = WIDGET_TEST_EVENTS[type].group;
      out.set(group, [...(out.get(group) ?? []), type]);
    }
    return [...out.entries()];
  }, []);

  function selectType(type: WidgetTestEventType) {
    setSelected(type);
    setPayloadText(prettyPayload(type));
    setPayloadEdited(false);
  }

  /** The payload for `type`: the author's edit if it applies, otherwise a fresh fixture. */
  function resolvePayload(type: WidgetTestEventType): Record<string, unknown> | null {
    if (type !== selected || !payloadEdited) {
      return WIDGET_TEST_EVENTS[type].build();
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

  function fire(type: WidgetTestEventType) {
    const payload = resolvePayload(type);
    if (!payload) return;

    if (mode === "local") {
      onFireLocal(type, payload);
      return;
    }

    startSend(async () => {
      const custom = type === selected && payloadEdited ? payload : undefined;
      const { ok, error } = await sendTestEventToOverlay(type, custom);
      if (!ok) toast.error(error ?? "Could not send the test event");
    });
  }

  const liveDisabled = !wsConnected;

  return (
    <div className="shrink-0 border-b bg-background">
      <div className="px-3 py-1.5 flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-muted-foreground mr-1 shrink-0">Test:</span>

        {PINNED.map((type) => (
          <Button
            key={type}
            size="sm"
            variant="outline"
            className="h-6 text-[11px] px-2"
            disabled={isSending}
            onClick={() => fire(type)}
          >
            {WIDGET_TEST_EVENTS[type].label}
          </Button>
        ))}

        <Select value={selected} onValueChange={(v) => selectType(v as WidgetTestEventType)}>
          <SelectTrigger className="h-6 text-[11px] w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {grouped.map(([group, types]) => (
              <SelectGroup key={group}>
                <SelectLabel className="text-[10px]">{group}</SelectLabel>
                {types.map((type) => (
                  <SelectItem key={type} value={type} className="text-xs">
                    {WIDGET_TEST_EVENTS[type].label}
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
              mode === "local" ? "bg-accent text-foreground" : "text-muted-foreground"
            }`}
          >
            Local
          </button>
          <button
            type="button"
            onClick={() => setMode("live")}
            disabled={liveDisabled}
            title={
              liveDisabled
                ? "Connect to live events first — Live sends through the overlay server"
                : "Send through ws-server to every overlay in your room"
            }
            className={`text-[11px] px-2 py-0.5 transition-colors disabled:opacity-40 ${
              mode === "live" ? "bg-accent text-foreground" : "text-muted-foreground"
            }`}
          >
            Live
          </button>
        </div>
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
              Edits apply to {WIDGET_TEST_EVENTS[selected].label} only.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
