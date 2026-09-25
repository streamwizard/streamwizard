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
 * One bar per choice, filling by its share of the votes, with the name and
 * number laid over it. The default look.
 */
export function PollBars({ view, cfg, pulses }: PollPresetProps) {
  const rowMax = Math.round(cfg.fontSize * 2.2);
  const radius = capRadius(cfg.radius, rowMax);
  const pad = Math.round(cfg.fontSize * 0.6);
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
      <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: Math.round(cfg.fontSize * 0.35) }}>
        {view.choices.map((c) => {
          const value = choiceValueText(c, cfg);
          return (
            <div
              key={c.id}
              className="sw-goal-motion"
              style={{
                position: "relative",
                flex: "1 1 0",
                maxHeight: rowMax,
                minHeight: 0,
                borderRadius: radius,
                background: trackPaint(cfg),
                overflow: "hidden",
                opacity: choiceOpacity(view, c),
                transition: `opacity ${SHARE_MS}ms ease`,
                ...winnerStyle(c, cfg),
              }}
            >
              <div
                className="sw-goal-motion"
                style={{
                  position: "absolute",
                  inset: "0 auto 0 0",
                  width: `${c.share * 100}%`,
                  background: c.color,
                  borderRadius: radius,
                  transition: `width ${SHARE_MS}ms ${SHARE_EASE}, background-color ${SHARE_MS}ms ease`,
                }}
              >
                <VoteFlash pulse={pulses[c.id]} radius={radius} />
              </div>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: pad,
                  padding: `0 ${pad}px`,
                  minWidth: 0,
                }}
              >
                <span style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.title}
                </span>
                {value && (
                  <FitText align="right" style={{ flexShrink: 0, maxWidth: "45%" }}>
                    {value}
                  </FitText>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
