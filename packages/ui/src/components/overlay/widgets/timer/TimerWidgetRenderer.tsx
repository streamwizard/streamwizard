"use client";

import { useEffect, useState } from "react";
import { useGoogleFont } from "../../hooks/use-google-font";
import { formatCountdownMs, formatElapsedMs } from "../../lib/format-countdown";
import {
  normalizeTimerWidgetConfig,
  resolvedTextWidgetFontFamily,
  type TimerWidgetItemConfig,
} from "../../types";
import type { WidgetRenderProps } from "../text/TextWidgetRenderer";

function justifyForAlign(align: "left" | "center" | "right"): string {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

/**
 * The instant the display is measured against: the deadline of a countdown, or
 * the start of a stopwatch. Null when a countdown's target date is unreadable.
 */
function anchorMsFromConfig(cfg: TimerWidgetItemConfig): number | null {
  if (cfg.countdownMode === "absolute") {
    const t = Date.parse(cfg.targetAtIso);
    return Number.isNaN(t) ? null : t;
  }
  if (cfg.countdownMode === "stopwatch") return Date.now();
  return Date.now() + cfg.durationSeconds * 1000;
}

function computeDisplay(cfg: TimerWidgetItemConfig, anchorMs: number | null): string {
  if (anchorMs === null) return cfg.finishedText;
  if (cfg.countdownMode === "stopwatch") return formatElapsedMs(Date.now() - anchorMs);
  const left = anchorMs - Date.now();
  if (left <= 0) return cfg.finishedText;
  return formatCountdownMs(left);
}

export function TimerWidgetRenderer({ item }: WidgetRenderProps) {
  const cfg = normalizeTimerWidgetConfig(item.config);
  const fontFamily = resolvedTextWidgetFontFamily(cfg);
  useGoogleFont(fontFamily);

  const [display, setDisplay] = useState(() => computeDisplay(cfg, anchorMsFromConfig(cfg)));

  useEffect(() => {
    const c = normalizeTimerWidgetConfig(item.config);
    const anchor = anchorMsFromConfig(c);
    const tick = () => setDisplay(computeDisplay(c, anchor));

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [item.config]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: justifyForAlign(cfg.align),
        boxSizing: "border-box",
        padding: "4px 8px",
        color: cfg.color,
        fontSize: cfg.fontSize,
        fontWeight: cfg.fontWeight,
        fontFamily: `"${fontFamily}", sans-serif`,
        textAlign: cfg.align,
      }}
    >
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          lineHeight: 1.375,
          maxWidth: "100%",
        }}
      >
        {display}
      </span>
    </div>
  );
}
