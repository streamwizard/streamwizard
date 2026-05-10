"use client";

import type { OverlayWidgetProps } from "@/components/widgets/types";
import type { Json } from "@/types/supabase";
import { useEffect, useMemo, useState } from "react";

function cfg(config: Json): Record<string, unknown> {
  return typeof config === "object" && config !== null && !Array.isArray(config)
    ? (config as Record<string, unknown>)
    : {};
}

const FALLBACK_TEXT_COLOR = "#ffffff";

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(sec)}`;
  return `${m}:${pad2(sec)}`;
}

export function TimerWidget({ item }: OverlayWidgetProps) {
  const raw = item.config;
  const c = cfg(raw);
  const fontSize = typeof c.fontSize === "number" ? c.fontSize : 24;
  const color =
    typeof c.color === "string" && c.color.startsWith("#")
      ? c.color
      : FALLBACK_TEXT_COLOR;
  const alignRaw = c.align;
  const textAlign =
    alignRaw === "center" || alignRaw === "right" ? alignRaw : "left";
  const fontWeight =
    c.fontWeight === 500 ||
    c.fontWeight === 600 ||
    c.fontWeight === 700 ||
    c.fontWeight === 400
      ? c.fontWeight
      : 400;
  const fontFamily =
    typeof c.fontFamily === "string" && c.fontFamily.trim()
      ? `"${c.fontFamily.trim()}", sans-serif`
      : "system-ui, sans-serif";

  const countdownMode = c.countdownMode === "absolute" ? "absolute" : "duration";
  const durationSeconds =
    typeof c.durationSeconds === "number" ? c.durationSeconds : 0;
  const targetAtIso =
    typeof c.targetAtIso === "string" ? c.targetAtIso : null;
  const finishedText =
    typeof c.finishedText === "string" ? c.finishedText : "00:00";

  const initialRemaining = useMemo(() => {
    if (countdownMode === "absolute" && targetAtIso) {
      const t = Date.parse(targetAtIso);
      if (!Number.isFinite(t)) return 0;
      return Math.max(0, (t - Date.now()) / 1000);
    }
    return Math.max(0, durationSeconds);
  }, [countdownMode, durationSeconds, targetAtIso]);

  const [remaining, setRemaining] = useState(initialRemaining);

  useEffect(() => {
    setRemaining(initialRemaining);
  }, [initialRemaining]);

  useEffect(() => {
    const tick = () => {
      if (countdownMode === "absolute" && targetAtIso) {
        const t = Date.parse(targetAtIso);
        if (!Number.isFinite(t)) {
          setRemaining(0);
          return;
        }
        setRemaining(Math.max(0, (t - Date.now()) / 1000));
        return;
      }
      setRemaining((r) => {
        const next = r - 1;
        return next > 0 ? next : 0;
      });
    };

    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [countdownMode, targetAtIso]);

  const label =
    remaining <= 0 ? finishedText : formatCountdown(remaining);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-start",
        justifyContent:
          textAlign === "center"
            ? "center"
            : textAlign === "right"
              ? "flex-end"
              : "flex-start",
        boxSizing: "border-box",
      }}
    >
      <span
        style={{
          fontSize,
          color,
          fontWeight,
          fontFamily,
          textAlign,
          lineHeight: 1.2,
        }}
      >
        {label}
      </span>
    </div>
  );
}
