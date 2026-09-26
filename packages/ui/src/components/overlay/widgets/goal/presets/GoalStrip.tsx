"use client";

import {
  EdgePulse,
  FitText,
  FILL_EASE,
  statsMaxWidth,
  FILL_MS,
  GoalIcon,
  capRadius,
  fillPaint,
  statsText,
  textStyle,
  trackPaint,
  type GoalPresetProps,
} from "./shared";

/**
 * One line of text with a hairline of progress under it. Built for tickers
 * and corners, where a full bar is too much.
 */
export function GoalStrip({ view, cfg, pulseKey }: GoalPresetProps) {
  // No title set here or on Twitch: show none rather than a made-up one.
  const showTitle = cfg.showTitle && view.title !== "";
  const lineHeight = Math.max(3, Math.round(cfg.fontSize * 0.16));
  const radius = capRadius(cfg.radius, lineHeight);
  const stats = [statsText(view, cfg), cfg.showRemaining ? view.remainingText : ""].filter(Boolean).join(" · ");
  const gap = Math.round(cfg.fontSize * 0.4);
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
        gap: Math.round(cfg.fontSize * 0.25),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap, minWidth: 0, whiteSpace: "nowrap" }}>
        {cfg.showIcon && (
          <GoalIcon kind={view.icon} url={cfg.iconUrl} size={Math.round(cfg.fontSize * 0.95)} color={cfg.fillColor} />
        )}
        {showTitle && (
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", opacity: 0.8 }}>{view.title}</span>
        )}
        {stats && (
          <FitText align="right" style={{ marginLeft: "auto", flexShrink: 0, maxWidth: statsMaxWidth(showTitle) }}>
            {stats}
          </FitText>
        )}
      </div>
      <div style={{ position: "relative", height: lineHeight, borderRadius: radius, background: trackPaint(cfg) }}>
        <div
          className="sw-goal-motion"
          style={{
            position: "absolute",
            inset: "0 auto 0 0",
            width: `${view.progress * 100}%`,
            transition: `width ${FILL_MS}ms ${FILL_EASE}`,
            background: fillPaint(cfg),
            borderRadius: radius,
          }}
        >
          <EdgePulse pulseKey={pulseKey} color={cfg.fillColor} size={lineHeight * 6} />
        </div>
      </div>
    </div>
  );
}
