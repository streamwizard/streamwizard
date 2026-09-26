"use client";

import { AdIcon, DRAIN_TRANSITION, FitText, capRadius, hexToRgba, textStyle, urgentStyle, type AdPresetProps } from "./shared";

/** A compact badge: icon, the line with its countdown, and a thin drain along the bottom. */
export function AdPill({ view, cfg }: AdPresetProps) {
  const pad = Math.round(cfg.fontSize * 0.7);
  return (
    <div
      className="sw-goal-motion"
      style={{
        ...textStyle(cfg),
        position: "relative",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: Math.round(cfg.fontSize * 0.5),
        padding: `0 ${pad}px`,
        borderRadius: capRadius(cfg.radius, 9999),
        background: hexToRgba(cfg.trackColor, cfg.trackOpacity),
        overflow: "hidden",
        ...urgentStyle(view, cfg),
      }}
    >
      {cfg.showIcon && <AdIcon phase={view.phase} size={Math.round(cfg.fontSize * 1.15)} color={cfg.accentColor} />}
      <FitText style={{ flex: "1 1 auto" }}>{view.text}</FitText>
      {view.phase !== "back" && (
        <div
          className="sw-goal-motion"
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            height: 3,
            width: `${view.remaining * 100}%`,
            background: cfg.accentColor,
            transition: `width ${DRAIN_TRANSITION}`,
          }}
        />
      )}
    </div>
  );
}
