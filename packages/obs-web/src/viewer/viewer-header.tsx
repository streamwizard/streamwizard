"use client";

import type { ReactNode } from "react";
import { Clipboard, Maximize, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { Button, cn, Slider } from "@repo/ui";
import type { RelayState, ViewerPhase } from "./use-viewer-frame";

type Status = { label: string; tone: "ok" | "wait" | "bad" };

function statusOf(phase: ViewerPhase, relay: RelayState, video: boolean): Status {
  switch (phase.kind) {
    case "starting":
      return { label: "Starting", tone: "wait" };
    case "connecting":
      return { label: "Connecting", tone: "wait" };
    case "reconnecting":
      return { label: "Reconnecting", tone: "wait" };
    case "error":
      return { label: "Disconnected", tone: "bad" };
    case "connected":
      // Without a relay there is no picture status to go on.
      return relay === "paired" && !video ? { label: "Connecting", tone: "wait" } : { label: "Connected", tone: "ok" };
  }
}

const DOT = { ok: "bg-emerald-400", wait: "bg-amber-400 animate-pulse", bad: "bg-red-400" } as const;

const ICON_BUTTON = "size-8 text-white/70 hover:bg-white/10 hover:text-white";

export function ViewerHeader({
  name,
  logo,
  phase,
  relay,
  video,
  muted,
  volume,
  clipboardOpen,
  onToggleMute,
  onVolume,
  onToggleClipboard,
  onFullscreen,
  onReconnect,
}: {
  name: string;
  logo?: ReactNode;
  phase: ViewerPhase;
  relay: RelayState;
  video: boolean;
  muted: boolean;
  volume: number;
  clipboardOpen: boolean;
  onToggleMute: () => void;
  onVolume: (value: number) => void;
  onToggleClipboard: () => void;
  onFullscreen: () => void;
  onReconnect: () => void;
}) {
  const status = statusOf(phase, relay, video);
  const controls = relay === "paired" && phase.kind !== "error";

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 px-3">
      {logo}
      <span className="truncate font-mono text-sm text-white">{name}</span>
      <span className="flex items-center gap-1.5 text-xs text-white/60" role="status">
        <span className={cn("size-1.5 rounded-full", DOT[status.tone])} />
        {status.label}
      </span>

      <div className="ml-auto flex items-center gap-1">
        {controls && (
          <>
            <Button
              size="icon"
              variant="ghost"
              className={ICON_BUTTON}
              onClick={onToggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>
            <Slider
              className="w-24"
              min={0}
              max={100}
              step={1}
              value={[muted ? 0 : Math.round(volume * 100)]}
              onValueChange={([value]) => onVolume((value ?? 0) / 100)}
              aria-label="Volume"
            />
            <Button
              size="icon"
              variant="ghost"
              className={cn(ICON_BUTTON, clipboardOpen && "bg-white/10 text-white")}
              onClick={onToggleClipboard}
              aria-label="Clipboard"
              aria-pressed={clipboardOpen}
              title="Clipboard"
            >
              <Clipboard className="size-4" />
            </Button>
          </>
        )}
        <Button
          size="icon"
          variant="ghost"
          className={ICON_BUTTON}
          onClick={onFullscreen}
          disabled={!(phase.kind === "connected" || phase.kind === "reconnecting")}
          aria-label="Full screen"
          title="Full screen"
        >
          <Maximize className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className={ICON_BUTTON}
          onClick={onReconnect}
          aria-label="Reconnect"
          title="Reconnect"
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>
    </header>
  );
}
