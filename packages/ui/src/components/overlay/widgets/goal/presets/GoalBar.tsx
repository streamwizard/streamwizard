"use client";

import { RemainingLine, TitleRow } from "./TitleRow";
import {
  EdgePulse,
  FILL_EASE,
  FILL_MS,
  FillShine,
  capRadius,
  fillPaint,
  textStyle,
  trackPaint,
  type GoalPresetProps,
} from "./shared";

/** Title and numbers over a rounded bar. The default look. */
export function GoalBar({ view, cfg, pulseKey, celebrating }: GoalPresetProps) {
  const barHeight = Math.max(12, Math.round(cfg.fontSize * 1.1));
  const radius = capRadius(cfg.radius, barHeight);
  return (
    <div
      style={{
        ...textStyle(cfg),
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: Math.round(cfg.fontSize * 0.35),
      }}
    >
      <TitleRow view={view} cfg={cfg} />
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={view.target}
        aria-valuenow={view.current}
        aria-label={view.label}
        style={{ position: "relative", height: barHeight, borderRadius: radius, background: trackPaint(cfg) }}
      >
        <div
          className="sw-goal-motion"
          style={{
            // Width, not scaleX: a scaled fill would squash its rounded end.
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${view.progress * 100}%`,
            transition: `width ${FILL_MS}ms ${FILL_EASE}`,
            background: fillPaint(cfg),
            borderRadius: radius,
            overflow: "hidden",
          }}
        >
          <FillShine play={celebrating} />
        </div>
        <div
          className="sw-goal-motion"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${view.progress * 100}%`,
            transition: `width ${FILL_MS}ms ${FILL_EASE}`,
            pointerEvents: "none",
          }}
        >
          <EdgePulse pulseKey={pulseKey} color={cfg.fillMode === "gradient" ? cfg.fillColor2 : cfg.fillColor} size={barHeight * 2.2} />
        </div>
      </div>
      <RemainingLine view={view} cfg={cfg} />
    </div>
  );
}
