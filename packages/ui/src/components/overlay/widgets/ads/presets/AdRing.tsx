"use client";

import { AdIcon, DRAIN_TRANSITION, FitSvgText, FitText, hexToRgba, phaseLabel, textStyle, type AdPresetProps } from "./shared";

const R = 42;
const STROKE = 9;
const C = 2 * Math.PI * R;

/** A ring draining around the seconds left, the time big in the middle. */
export function AdRing({ view, cfg }: AdPresetProps) {
  const family = `"${cfg.fontFamily}", sans-serif`;
  const back = view.phase === "back";
  const urgent = view.phase === "warning" && view.secondsLeft <= 10;
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
        gap: Math.round(cfg.fontSize * 0.4),
      }}
    >
      <svg
        viewBox="0 0 100 100"
        role="timer"
        aria-label={view.text}
        style={{ flex: "1 1 auto", minHeight: 0, width: "100%", overflow: "visible" }}
      >
        <circle cx={50} cy={50} r={R + STROKE / 2 + 1} fill={hexToRgba(cfg.trackColor, cfg.trackOpacity)} />
        <circle cx={50} cy={50} r={R} fill="none" stroke={hexToRgba(cfg.textColor, 0.15)} strokeWidth={STROKE} />
        <circle
          className="sw-goal-motion"
          cx={50}
          cy={50}
          r={R}
          fill="none"
          stroke={cfg.accentColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - (back ? 1 : view.remaining))}
          transform="rotate(-90 50 50)"
          style={{
            transition: `stroke-dashoffset ${DRAIN_TRANSITION}`,
            filter: urgent ? `drop-shadow(0 0 4px ${cfg.accentColor})` : undefined,
          }}
        />
        <g style={{ filter: cfg.textShadow ? "drop-shadow(0 0.6px 1px rgba(0,0,0,0.85))" : undefined }}>
          {back ? (
            <path
              transform="translate(38 37)"
              d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.4.8-1.3 2.3-2.4 4.4-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"
              fill={cfg.accentColor}
            />
          ) : (
            <FitSvgText
              x={50}
              y={59}
              textAnchor="middle"
              fontSize={26}
              maxWidth={60}
              fill={cfg.textColor}
              style={{ fontFamily: family, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
            >
              {view.timeText}
            </FitSvgText>
          )}
        </g>
      </svg>
      <FitText align="center" style={{ width: "100%", flexShrink: 0 }}>
        {cfg.showIcon && !back ? (
          <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 6 }}>
            <AdIcon phase={view.phase} size={Math.round(cfg.fontSize * 0.95)} color={cfg.accentColor} />
          </span>
        ) : null}
        {phaseLabel(view, cfg)}
      </FitText>
    </div>
  );
}
