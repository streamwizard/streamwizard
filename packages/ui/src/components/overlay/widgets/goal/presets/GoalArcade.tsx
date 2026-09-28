"use client";

import { FILL_MS, FitText, GoalIcon, fillPaint, hexToRgba, statsMaxWidth, textStyle, type GoalPresetProps } from "./shared";

const HARD_SHADOW = "2px 2px 0 rgba(0,0,0,0.9)";
/** The fill moves in 5% steps, like an old game's XP bar. */
const STEPS = 20;

/**
 * A pixel XP bar: square corners, a stepped fill, a chunky frame, and LEVEL
 * UP when the goal is reached.
 */
export function GoalArcade({ view, cfg, pulseKey, celebrating }: GoalPresetProps) {
  // No title set here or on Twitch: show none rather than a made-up one.
  const showTitle = cfg.showTitle && view.title !== "";
  const stepped = view.reached ? 1 : Math.floor(view.progress * STEPS) / STEPS;
  const barHeight = Math.max(14, Math.round(cfg.fontSize * 1.25));
  const px = Math.max(2, Math.round(cfg.fontSize * 0.15));
  const frame = cfg.textColor;
  const small = Math.round(cfg.fontSize * 0.7);
  return (
    <div
      style={{
        ...textStyle(cfg, HARD_SHADOW),
        position: "relative",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: Math.round(cfg.fontSize * 0.5),
        padding: px,
        lineHeight: 1.1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: Math.round(cfg.fontSize * 0.5), minWidth: 0, whiteSpace: "nowrap" }}>
        {cfg.showIcon && <GoalIcon kind={view.icon} url={cfg.iconUrl} size={cfg.fontSize} color={cfg.fillColor} />}
        {showTitle && (
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{view.title}</span>
        )}
        {(cfg.showNumbers || cfg.showPercent) && (
          <FitText align="right" style={{ marginLeft: "auto", flexShrink: 0, maxWidth: statsMaxWidth(showTitle), fontSize: small }}>
            {cfg.showNumbers ? `${view.currentText}/${view.targetText}` : ""}
            {cfg.showNumbers && cfg.showPercent ? " " : ""}
            {cfg.showPercent ? view.percentText : ""}
          </FitText>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={view.target}
        aria-valuenow={view.current}
        aria-label={view.label}
        style={{
          position: "relative",
          height: barHeight,
          background: hexToRgba(cfg.trackColor, cfg.trackOpacity),
          // A pixel frame: four hard shadows instead of a border, so the corners stay stepped.
          boxShadow: `0 -${px}px 0 ${frame}, 0 ${px}px 0 ${frame}, -${px}px 0 0 ${frame}, ${px}px 0 0 ${frame}, ${px * 2}px ${px * 2}px 0 rgba(0,0,0,0.6)`,
          margin: `0 ${px}px`,
        }}
      >
        <div
          key={pulseKey > 0 ? pulseKey : undefined}
          className="sw-goal-motion"
          style={{
            position: "absolute",
            inset: "0 auto 0 0",
            width: `${stepped * 100}%`,
            background: fillPaint(cfg),
            // Steps, not a glide: the bar ticks up the way an XP bar does.
            transition: `width ${FILL_MS}ms steps(6, end)`,
            animation: pulseKey > 0 ? "sw-goal-block-pulse 500ms steps(3, end)" : undefined,
          }}
        >
          <span aria-hidden style={{ position: "absolute", left: 0, right: 0, top: 0, height: "30%", background: "rgba(255,255,255,0.3)" }} />
        </div>
        {/* Notches every 5%. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `repeating-linear-gradient(90deg, transparent 0 calc(${100 / STEPS}% - ${px}px), rgba(0,0,0,0.45) calc(${100 / STEPS}% - ${px}px) ${100 / STEPS}%)`,
          }}
        />
      </div>
      {cfg.showRemaining && (
        <FitText align="right" style={{ fontSize: small }}>
          {view.reached ? "GOAL!" : view.remainingText}
        </FitText>
      )}
      {celebrating && (
        <div
          key={celebrating.key}
          className="sw-goal-motion"
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            padding: `${px * 2}px ${px * 4}px`,
            background: cfg.fillColor,
            color: "#000",
            textShadow: "none",
            fontSize: Math.round(cfg.fontSize * 1.1),
            whiteSpace: "nowrap",
            boxShadow: `${px * 2}px ${px * 2}px 0 rgba(0,0,0,0.7)`,
            animation: "sw-goal-levelup 2200ms steps(8, end) forwards",
            opacity: 0,
          }}
        >
          LEVEL UP!
        </div>
      )}
    </div>
  );
}
