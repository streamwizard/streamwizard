"use client";

import { FitText, textStyle, type GoalPresetProps } from "./shared";

/** A thick dark edge, so big type reads over any footage without a plate. */
const OUTLINE_SHADOW =
  "0 2px 0 rgba(0,0,0,0.9), 0 -2px 0 rgba(0,0,0,0.9), 2px 0 0 rgba(0,0,0,0.9), -2px 0 0 rgba(0,0,0,0.9), 0 3px 8px rgba(0,0,0,0.6)";

/**
 * Just the words: the title on one line, the numbers on the next, centred
 * and outlined. No bar, no plate; the numbers pop when they move.
 */
export function GoalText({ view, cfg, pulseKey }: GoalPresetProps) {
  // No title set here or on Twitch: show none rather than a made-up one.
  const showTitle = cfg.showTitle && view.title !== "";
  const numbers = [
    cfg.showNumbers ? `${view.currentText}/${view.targetText}` : "",
    cfg.showPercent ? view.percentText : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const size = Math.round(cfg.fontSize * 1.7);
  const stroke = cfg.textShadow ? Math.max(1, Math.round(cfg.fontSize * 0.09)) : 0;
  const line = {
    ...textStyle(cfg, OUTLINE_SHADOW),
    fontSize: size,
    lineHeight: 1.1,
    // paint-order keeps the stroke behind the fill, so heavy strokes don't eat the letters.
    WebkitTextStroke: stroke ? `${stroke}px rgba(0,0,0,0.9)` : undefined,
    paintOrder: "stroke fill",
    textTransform: "uppercase" as const,
    letterSpacing: "0.01em",
  };
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: Math.round(cfg.fontSize * 0.15),
        textAlign: "center",
      }}
    >
      {showTitle && (
        <FitText align="center" style={{ ...line, opacity: 0.95 }}>
          {view.title}
          {numbers ? ":" : ""}
        </FitText>
      )}
      {numbers && (
        <div
          key={pulseKey}
          className="sw-goal-motion"
          style={{
            width: "100%",
            animation: cfg.pulseOnProgress && pulseKey > 0 ? "sw-goal-text-pop 500ms cubic-bezier(0.2, 0.8, 0.2, 1) both" : undefined,
          }}
        >
          <FitText align="center" style={line}>
            {numbers}
          </FitText>
        </div>
      )}
      {cfg.showRemaining && (
        <FitText align="center" style={{ ...line, fontSize: Math.round(size * 0.55), opacity: 0.9 }}>
          {view.remainingText}
        </FitText>
      )}
    </div>
  );
}
