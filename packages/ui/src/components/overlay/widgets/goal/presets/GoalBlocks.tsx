"use client";

import { goalBlockCount, goalBlocksLit } from "../goal-view";
import { RemainingLine, TitleRow } from "./TitleRow";
import { FILL_EASE, FILL_MS, capRadius, mixHex, textStyle, trackPaint, type GoalPresetProps } from "./shared";

/**
 * The bar in segments that light up one by one, like a health bar. With a
 * small target every follow or sub gets its own block.
 */
export function GoalBlocks({ view, cfg, pulseKey, celebrating }: GoalPresetProps) {
  const count = goalBlockCount(view.target, cfg.blockCount);
  const { full, partial } = goalBlocksLit(view.progress, count);
  const blockHeight = Math.max(14, Math.round(cfg.fontSize * 1.3));
  const gap = Math.max(2, Math.round(blockHeight * 0.18));
  const radius = capRadius(cfg.radius, blockHeight) * 0.5;
  // The block that just lit up (or is filling) is the one that pulses.
  const edge = partial > 0 ? full : full - 1;
  const colorAt = (i: number) =>
    cfg.fillMode === "gradient" ? mixHex(cfg.fillColor, cfg.fillColor2, count > 1 ? i / (count - 1) : 0) : cfg.fillColor;
  const shining = celebrating?.kind === "shine";
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
        gap: Math.round(cfg.fontSize * 0.35),
      }}
    >
      <TitleRow view={view} cfg={cfg} />
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={view.target}
        aria-valuenow={view.current}
        aria-label={view.label}
        style={{ display: "flex", gap, height: blockHeight }}
      >
        {Array.from({ length: count }, (_, i) => {
          const fill = i < full ? 1 : i === full ? partial : 0;
          const pulse = i === edge && pulseKey > 0;
          return (
            <div
              key={i}
              style={{ position: "relative", flex: "1 1 0", borderRadius: radius, background: trackPaint(cfg), overflow: "hidden" }}
            >
              <div
                key={pulse ? `p${pulseKey}` : shining ? `s${celebrating?.key}` : "b"}
                className="sw-goal-motion"
                style={{
                  position: "absolute",
                  inset: "0 auto 0 0",
                  width: `${fill * 100}%`,
                  background: colorAt(i),
                  transition: `width ${FILL_MS}ms ${FILL_EASE}`,
                  animation: pulse
                    ? "sw-goal-block-pulse 700ms ease-out"
                    : shining
                      ? `sw-goal-block-pulse 500ms ease-out ${i * 45}ms 2 both`
                      : undefined,
                  boxShadow: fill > 0 ? "inset 0 2px 0 rgba(255,255,255,0.25)" : undefined,
                }}
              />
            </div>
          );
        })}
      </div>
      <RemainingLine view={view} cfg={cfg} />
    </div>
  );
}
