"use client";

import {
  FitSvgText,
  FitText,
  PollHeader,
  SHARE_EASE,
  SHARE_MS,
  choiceOpacity,
  choiceValueText,
  hexToRgba,
  textStyle,
  type PollPresetProps,
} from "./shared";

const R = 40;
const STROKE = 13;
const C = 2 * Math.PI * R;
/** Space between segments, in user units along the ring. */
const GAP = 1.6;

/**
 * A ring split by vote share, the leader's percent in the middle and a legend
 * beside it. Made for a camera corner.
 */
export function PollDonut({ view, cfg, pulses }: PollPresetProps) {
  const voted = view.choices.filter((c) => c.votes > 0).length;
  const gap = voted > 1 ? GAP : 0;
  let start = 0;
  const segments = view.choices.map((c) => {
    const length = c.share * C;
    const seg = { choice: c, start, length: Math.max(0, length - gap) };
    start += length;
    return seg;
  });

  const lead = view.leader;
  const tie = view.resultText === "Tie";
  // Middle of the ring: the leader's share and name; at the end, the winner,
  // or just "Tie".
  const centreBig = tie ? "Tie" : lead ? lead.percentText : "0%";
  const centreSmall = tie ? "" : lead ? lead.title : view.ended ? "No votes" : "No votes yet";
  const family = `"${cfg.fontFamily}", sans-serif`;
  const dot = Math.round(cfg.fontSize * 0.62);

  return (
    <div
      style={{
        ...textStyle(cfg),
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: Math.round(cfg.fontSize * 0.5),
      }}
    >
      <PollHeader view={view} cfg={cfg} />
      <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", alignItems: "center", gap: Math.round(cfg.fontSize * 0.9) }}>
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label={view.label}
          style={{ height: "100%", maxWidth: "45%", aspectRatio: "1", flexShrink: 0, overflow: "visible" }}
        >
          <circle cx={50} cy={50} r={R} fill="none" stroke={hexToRgba(cfg.trackColor, cfg.trackOpacity)} strokeWidth={STROKE} />
          <g transform="rotate(-90 50 50)">
            {segments.map(({ choice, start: from, length }) => (
              <circle
                key={choice.id}
                className="sw-goal-motion"
                cx={50}
                cy={50}
                r={R}
                fill="none"
                stroke={choice.color}
                strokeWidth={choice.isWinner ? STROKE + 3 : STROKE}
                strokeDasharray={`${length} ${C}`}
                strokeDashoffset={-from}
                opacity={choiceOpacity(view, choice)}
                style={{
                  transition: `stroke-dasharray ${SHARE_MS}ms ${SHARE_EASE}, stroke-dashoffset ${SHARE_MS}ms ${SHARE_EASE}, stroke-width 300ms ease, opacity ${SHARE_MS}ms ease`,
                }}
              />
            ))}
          </g>
          <g style={{ filter: cfg.textShadow ? "drop-shadow(0 0.6px 1px rgba(0,0,0,0.85))" : undefined }}>
            <FitSvgText
              x={50}
              y={centreSmall ? 50 : 57}
              textAnchor="middle"
              fontSize={20}
              maxWidth={54}
              fill={cfg.textColor}
              style={{ fontFamily: family, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
            >
              {centreBig}
            </FitSvgText>
            {centreSmall && (
              <FitSvgText
                x={50}
                y={64}
                textAnchor="middle"
                fontSize={9}
                maxWidth={52}
                fill={cfg.textColor}
                style={{ fontFamily: family, fontWeight: cfg.fontWeight, opacity: 0.85 }}
              >
                {centreSmall}
              </FitSvgText>
            )}
          </g>
        </svg>
        <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: Math.round(cfg.fontSize * 0.35) }}>
          {view.choices.map((c) => {
            const value = choiceValueText(c, cfg);
            return (
              <div
                key={c.id}
                className="sw-goal-motion"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: Math.round(cfg.fontSize * 0.45),
                  minWidth: 0,
                  opacity: choiceOpacity(view, c),
                  transition: `opacity ${SHARE_MS}ms ease`,
                  fontWeight: c.isWinner ? 700 : undefined,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    position: "relative",
                    width: dot,
                    height: dot,
                    borderRadius: "50%",
                    background: c.color,
                    flexShrink: 0,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.6)",
                    overflow: "hidden",
                  }}
                >
                  {pulses[c.id] ? (
                    <span
                      key={pulses[c.id]}
                      className="sw-goal-motion sw-goal-pulse"
                      style={{ position: "absolute", inset: 0, background: "#fff", opacity: 0, animation: "sw-poll-flash 500ms ease-out" }}
                    />
                  ) : null}
                </span>
                <span style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.title}
                </span>
                {value && (
                  <FitText align="right" style={{ flexShrink: 0, maxWidth: "45%" }}>
                    {value}
                  </FitText>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
