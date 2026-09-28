"use client";

import { useId } from "react";
import { FILL_EASE, FILL_MS, FitSvgText, FitText, GoalIcon, hexToRgba, textStyle, type GoalPresetProps } from "./shared";

const R = 42;
const CIRCUMFERENCE = 2 * Math.PI * R;

/**
 * A ring filling clockwise from the top, the current number big in the
 * middle. The number is the loud part; everything else sits under the ring.
 */
export function GoalRing({ view, cfg, pulseKey, celebrating }: GoalPresetProps) {
  // No title set here or on Twitch: show none rather than a made-up one.
  const showTitle = cfg.showTitle && view.title !== "";
  const gradientId = `sw-goal-ring-${useId().replace(/:/g, "")}`;
  const stroke = cfg.fillMode === "gradient" ? `url(#${gradientId})` : cfg.fillColor;
  const shining = celebrating?.kind === "shine";
  // SVG text ignores text-shadow; a drop-shadow filter does the same job.
  const textFilter = cfg.textShadow ? "drop-shadow(0 0.5px 1px rgba(0,0,0,0.85))" : undefined;
  return (
    <div
      style={{
        ...textStyle(cfg),
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: Math.round(cfg.fontSize * 0.35),
        textAlign: "center",
      }}
    >
      <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0, width: "100%", display: "flex", justifyContent: "center" }}>
        <svg
          viewBox="0 0 100 100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={view.target}
          aria-valuenow={view.current}
          aria-label={view.label}
          style={{ height: "100%", maxWidth: "100%", aspectRatio: "1", overflow: "visible" }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={cfg.fillColor} />
              <stop offset="100%" stopColor={cfg.fillColor2} />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r={R} fill="none" stroke={hexToRgba(cfg.trackColor, cfg.trackOpacity)} strokeWidth="9" />
          <circle
            key={shining ? `shine-${celebrating?.key}` : `pulse-${pulseKey}`}
            className="sw-goal-motion"
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={stroke}
            strokeWidth="9"
            strokeLinecap={view.progress > 0 ? "round" : "butt"}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - view.progress)}
            transform="rotate(-90 50 50)"
            style={{
              transition: `stroke-dashoffset ${FILL_MS}ms ${FILL_EASE}`,
              animation:
                shining
                  ? "sw-goal-ring-pulse 600ms ease-out 3"
                  : pulseKey > 0
                    ? "sw-goal-ring-pulse 650ms ease-out"
                    : undefined,
            }}
          />
          {/* The ring's inside is ~74 units across; keep text a little clear of the stroke. */}
          <FitSvgText
            x="50"
            y={cfg.showNumbers ? 50 : 56}
            textAnchor="middle"
            fill={cfg.textColor}
            fontSize={26}
            maxWidth={62}
            style={{ fontWeight: 700, fontFamily: `"${cfg.fontFamily}", sans-serif`, filter: textFilter }}
          >
            {view.currentText}
          </FitSvgText>
          {cfg.showNumbers && (
            <FitSvgText
              x="50"
              y="66"
              textAnchor="middle"
              fill={cfg.textColor}
              opacity={0.8}
              fontSize={9}
              maxWidth={58}
              style={{ fontFamily: `"${cfg.fontFamily}", sans-serif`, filter: textFilter }}
            >
              {`of ${view.targetText} ${view.unit}`}
            </FitSvgText>
          )}
        </svg>
      </div>
      {(showTitle || cfg.showIcon) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, maxWidth: "100%" }}>
          {cfg.showIcon && <GoalIcon kind={view.icon} url={cfg.iconUrl} size={cfg.fontSize} color={cfg.fillColor} />}
          {showTitle && (
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{view.title}</span>
          )}
        </div>
      )}
      {(cfg.showPercent || cfg.showRemaining) && (
        <FitText align="center" style={{ width: "100%", flexShrink: 0, fontSize: Math.round(cfg.fontSize * 0.72), opacity: 0.85 }}>
          {[cfg.showPercent ? view.percentText : "", cfg.showRemaining ? view.remainingText : ""].filter(Boolean).join(" · ")}
        </FitText>
      )}
    </div>
  );
}
