"use client";

import type { CSSProperties } from "react";
import {
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

/**
 * How far along the lane the leader runs while the poll is open. The finish
 * line is kept for the winner: it crosses when the poll closes.
 */
const OPEN_REACH = 0.82;

/**
 * A lane per choice: each runner moves toward the chequered line by its
 * votes against the leader's, leaving a trail. When the poll closes, the
 * winner crosses.
 */
export function PollRace({ view, cfg, pulses }: PollPresetProps) {
  const laneMax = Math.round(cfg.fontSize * 2);
  const runner = Math.round(cfg.fontSize * 1.05);
  const finish = Math.max(6, Math.round(cfg.fontSize * 0.45));
  const checker = Math.max(3, Math.round(finish / 2));
  const anyValue = cfg.showPercent || cfg.showVotes;

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
      <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: Math.round(cfg.fontSize * 0.25) }}>
        {view.choices.map((c) => {
          const reach = c.isWinner ? 1 : c.relative * OPEN_REACH;
          // The runner's left edge: along the lane, never past its end.
          const left = `calc((100% - ${runner}px) * ${reach})`;
          const value = choiceValueText(c, cfg);
          return (
            <div
              key={c.id}
              className="sw-goal-motion"
              style={{
                flex: "1 1 0",
                maxHeight: laneMax,
                minHeight: 0,
                display: "flex",
                alignItems: "center",
                gap: Math.round(cfg.fontSize * 0.5),
                opacity: choiceOpacity(view, c),
                transition: `opacity ${SHARE_MS}ms ease`,
              }}
            >
              <span
                style={{
                  width: "26%",
                  flexShrink: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: c.isWinner ? 700 : undefined,
                }}
              >
                {c.title}
              </span>
              <div style={{ position: "relative", flex: "1 1 auto", alignSelf: "stretch", minWidth: 0 }}>
                {/* The lane: a faint line in the text colour, so it reads on any footage. */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "50%",
                    height: 2,
                    marginTop: -1,
                    background: hexToRgba(cfg.textColor, 0.3),
                    boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
                  }}
                />
                {/* Finish line. */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "8%",
                    bottom: "8%",
                    width: finish,
                    backgroundImage: "repeating-conic-gradient(#ffffff 0 25%, #16161d 0 50%)",
                    backgroundSize: `${checker * 2}px ${checker * 2}px`,
                    opacity: 0.9,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.6)",
                  }}
                />
                {/* Trail, from the start to the runner. */}
                <div
                  className="sw-goal-motion"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "50%",
                    height: Math.max(3, Math.round(runner * 0.36)),
                    transform: "translateY(-50%)",
                    width: `calc(${left} + ${runner / 2}px)`,
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${hexToRgba(c.color, 0)}, ${c.color})`,
                    opacity: c.isLeader ? 0.9 : 0.5,
                    transition: `width ${SHARE_MS}ms ${SHARE_EASE}`,
                  }}
                />
                {/* Runner. */}
                <div
                  className="sw-goal-motion"
                  style={
                    {
                      position: "absolute",
                      top: "50%",
                      left,
                      width: runner,
                      height: runner,
                      marginTop: -runner / 2,
                      borderRadius: "50%",
                      background: c.color,
                      border: `2px solid ${hexToRgba("#ffffff", 0.85)}`,
                      boxSizing: "border-box",
                      boxShadow: c.isLeader ? `0 0 12px ${c.color}` : "0 1px 3px rgba(0,0,0,0.6)",
                      transition: `left ${SHARE_MS}ms ${SHARE_EASE}`,
                      overflow: "hidden",
                    } as CSSProperties
                  }
                >
                  {pulses[c.id] ? (
                    <span
                      key={pulses[c.id]}
                      className="sw-goal-motion sw-goal-pulse"
                      style={{ position: "absolute", inset: 0, background: "#fff", opacity: 0, animation: "sw-poll-flash 500ms ease-out" }}
                    />
                  ) : null}
                </div>
              </div>
              {anyValue && (
                <FitText align="right" style={{ width: cfg.showVotes && cfg.showPercent ? "24%" : "13%", flexShrink: 0 }}>
                  {value}
                </FitText>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
