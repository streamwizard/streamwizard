"use client";

import { FitText, SWAP_ANIMATION, capRadius, hexToRgba, inkOn, textStyle, urgentStyle, type AdPresetProps } from "./shared";

/**
 * Twitch's own ad marker: a dark plate with a bold accent chip reading "Ad"
 * and the line beside it. No drain; the countdown in the text is the clock.
 * The plate stays put across phases; the chip and the line swap in place.
 */
export function AdBadge({ view, cfg }: AdPresetProps) {
  const pad = Math.round(cfg.fontSize * 0.55);
  const chip = Math.round(cfg.fontSize * 2.2);
  const radius = capRadius(cfg.radius, 9999);
  const ink = inkOn(cfg.accentColor);
  const back = view.phase === "back";
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
        gap: Math.round(cfg.fontSize * 0.7),
        padding: `0 ${pad}px`,
        borderRadius: radius,
        background: hexToRgba(cfg.trackColor, cfg.trackOpacity),
        overflow: "hidden",
        ...urgentStyle(view, cfg),
      }}
    >
      {cfg.showIcon && (
        <div
          aria-hidden
          style={{
            width: chip,
            height: chip,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: Math.max(4, Math.round(Math.min(radius, chip) * 0.3)),
            background: cfg.accentColor,
            color: ink,
            fontWeight: 700,
            fontSize: Math.round(cfg.fontSize * 1.05),
            textShadow: "none",
            letterSpacing: "-0.01em",
            overflow: "hidden",
          }}
        >
          {back ? (
            <svg
              key="check"
              className="sw-goal-motion"
              viewBox="0 0 24 24"
              style={{ width: chip * 0.6, height: chip * 0.6, display: "block", animation: SWAP_ANIMATION }}
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <span key="ad" className="sw-goal-motion" style={{ display: "block", animation: SWAP_ANIMATION }}>
              Ad
            </span>
          )}
        </div>
      )}
      <div key={view.phase} className="sw-goal-motion" style={{ flex: "1 1 auto", minWidth: 0, animation: SWAP_ANIMATION }}>
        <FitText>{view.text}</FitText>
      </div>
    </div>
  );
}
