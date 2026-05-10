"use client";

import { useGoogleFont } from "@/hooks/use-google-font";
import { formatCountdownMs } from "@/lib/format-countdown";
import {
  normalizeTimerWidgetConfig,
  resolvedTextWidgetFontFamily,
  type TimerWidgetItemConfig,
} from "@/types/overlays";
import { useEffect, useState } from "react";
import type { OverlayCanvasProps } from "../../registry/overlay-widget-registry.types";

function justifyForAlign(align: "left" | "center" | "right") {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

function computeTimerDisplay(
  cfg: TimerWidgetItemConfig,
  deadlineMs: number
): string {
  const left = deadlineMs - Date.now();
  if (left <= 0) return cfg.finishedText;
  return formatCountdownMs(left);
}

function deadlineMsFromConfig(cfg: TimerWidgetItemConfig): number | null {
  if (cfg.countdownMode === "absolute") {
    const t = Date.parse(cfg.targetAtIso);
    return Number.isNaN(t) ? null : t;
  }
  return Date.now() + cfg.durationSeconds * 1000;
}

export function TimerWidgetCanvas({ item, zoom }: OverlayCanvasProps) {
  const cfg = normalizeTimerWidgetConfig(item.config);
  const fontFamily = resolvedTextWidgetFontFamily(cfg);
  useGoogleFont(fontFamily);

  const initialDeadline = deadlineMsFromConfig(cfg);
  const [display, setDisplay] = useState(() =>
    initialDeadline === null
      ? "—"
      : computeTimerDisplay(cfg, initialDeadline)
  );

  useEffect(() => {
    const c = normalizeTimerWidgetConfig(item.config);
    const deadline = deadlineMsFromConfig(c);

    function tick() {
      if (deadline === null) {
        setDisplay("—");
        return;
      }
      setDisplay(computeTimerDisplay(c, deadline));
    }

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [item.config]);

  return (
    <div
      className="w-full h-full overflow-hidden px-2 py-1"
      style={{
        color: cfg.color,
        fontSize: cfg.fontSize * zoom,
        fontWeight: cfg.fontWeight,
        fontFamily: `"${fontFamily}", sans-serif`,
        textAlign: cfg.align,
        display: "flex",
        alignItems: "center",
        justifyContent: justifyForAlign(cfg.align),
      }}
    >
      <span className="tabular-nums whitespace-nowrap leading-snug max-w-full">
        {display}
      </span>
    </div>
  );
}
