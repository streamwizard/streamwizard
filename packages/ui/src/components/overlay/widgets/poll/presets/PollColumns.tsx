"use client";

import {
  FitText,
  PollHeader,
  SHARE_EASE,
  SHARE_MS,
  VoteFlash,
  capRadius,
  choiceOpacity,
  choiceValueText,
  textStyle,
  trackPaint,
  winnerStyle,
  type PollPresetProps,
} from "./shared";

/**
 * Columns side by side, rising like a live chart. The tallest column is the
 * leader; the number rides on top of each one.
 */
export function PollColumns({ view, cfg, pulses }: PollPresetProps) {
  const gap = Math.round(cfg.fontSize * (view.choices.length > 3 ? 0.5 : 0.9));
  const label = Math.round(cfg.fontSize * 1.35);
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
      <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", gap }}>
        {view.choices.map((c) => {
          const value = choiceValueText(c, cfg);
          return (
            <div
              key={c.id}
              className="sw-goal-motion"
              style={{
                flex: "1 1 0",
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: Math.round(cfg.fontSize * 0.3),
                opacity: choiceOpacity(view, c),
                transition: `opacity ${SHARE_MS}ms ease`,
              }}
            >
              {/* Room on top for the number riding the column. */}
              <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0, paddingTop: value ? label : 0 }}>
                <div style={{ position: "relative", height: "100%" }}>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: capRadius(cfg.radius, 9999),
                      background: trackPaint(cfg),
                    }}
                  />
                  <div
                    className="sw-goal-motion"
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: `${c.relative * 100}%`,
                      minHeight: c.votes > 0 ? 4 : 0,
                      background: c.color,
                      borderRadius: cfg.radius,
                      transition: `height ${SHARE_MS}ms ${SHARE_EASE}, background-color ${SHARE_MS}ms ease`,
                      ...winnerStyle(c, cfg),
                    }}
                  >
                    <VoteFlash pulse={pulses[c.id]} radius={cfg.radius} />
                  </div>
                  {value && (
                    <div
                      className="sw-goal-motion"
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: `${c.relative * 100}%`,
                        transition: `bottom ${SHARE_MS}ms ${SHARE_EASE}`,
                        paddingBottom: 4,
                      }}
                    >
                      <FitText align="center">{value}</FitText>
                    </div>
                  )}
                </div>
              </div>
              <FitText align="center" style={{ flexShrink: 0, fontSize: Math.round(cfg.fontSize * 0.85) }}>
                {c.title}
              </FitText>
            </div>
          );
        })}
      </div>
    </div>
  );
}
