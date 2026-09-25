"use client";

import { AdIcon, DRAIN_TRANSITION, FitText, capRadius, hexToRgba, textStyle, urgentStyle, type AdPresetProps } from "./shared";

/**
 * A card for the break itself: the line with its countdown, a message for
 * viewers, and a thick drain along the bottom. Works as a small "be right
 * back" screen while the ads run.
 */
export function AdCard({ view, cfg }: AdPresetProps) {
  const pad = Math.round(cfg.fontSize * 0.9);
  const radius = capRadius(cfg.radius, 9999);
  const message = view.phase === "running" ? cfg.cardMessage.trim() : "";
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
        flexDirection: "column",
        justifyContent: "center",
        gap: Math.round(cfg.fontSize * 0.5),
        padding: `${pad}px ${pad}px ${pad + 8}px`,
        borderRadius: Math.min(radius, 32),
        background: hexToRgba(cfg.trackColor, cfg.trackOpacity),
        overflow: "hidden",
        ...urgentStyle(view, cfg),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: Math.round(cfg.fontSize * 0.55), minWidth: 0 }}>
        {cfg.showIcon && <AdIcon phase={view.phase} size={Math.round(cfg.fontSize * 1.6)} color={cfg.accentColor} />}
        <FitText style={{ flex: "1 1 auto", fontSize: Math.round(cfg.fontSize * 1.35), fontWeight: 700 }}>{view.text}</FitText>
      </div>
      {message && (
        <span
          style={{
            opacity: 0.85,
            fontWeight: 400,
            overflowWrap: "anywhere",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {message}
        </span>
      )}
      <div
        className="sw-goal-motion"
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 8,
          width: `${(view.phase === "back" ? 1 : view.remaining) * 100}%`,
          background: cfg.accentColor,
          transition: `width ${DRAIN_TRANSITION}`,
        }}
      />
    </div>
  );
}
