"use client";

import { AdIcon, DRAIN_TRANSITION, FitText, capRadius, hexToRgba, textStyle, urgentStyle, type AdPresetProps } from "./shared";

/** The line over a bar that drains as the time runs out. */
export function AdBar({ view, cfg }: AdPresetProps) {
  const barHeight = Math.max(10, Math.round(cfg.fontSize * 0.8));
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
      <div style={{ display: "flex", alignItems: "center", gap: Math.round(cfg.fontSize * 0.45), minWidth: 0 }}>
        {cfg.showIcon && <AdIcon phase={view.phase} size={Math.round(cfg.fontSize * 1.05)} color={cfg.accentColor} />}
        <FitText style={{ flex: "1 1 auto" }}>{view.text}</FitText>
      </div>
      <div
        className="sw-goal-motion"
        role="timer"
        aria-label={view.text}
        style={{
          position: "relative",
          height: barHeight,
          borderRadius: radius,
          background: hexToRgba(cfg.trackColor, cfg.trackOpacity),
          overflow: "hidden",
          ...urgentStyle(view, cfg),
        }}
      >
        <div
          className="sw-goal-motion"
          style={{
            position: "absolute",
            inset: "0 auto 0 0",
            // The welcome back fills the bar: the wait is over.
            width: `${(view.phase === "back" ? 1 : view.remaining) * 100}%`,
            background: cfg.accentColor,
            borderRadius: radius,
            transition: `width ${DRAIN_TRANSITION}`,
          }}
        />
      </div>
    </div>
  );
}
