"use client";

import { SectionBlock, StepStage, hexToRgba, type CreditsPresetProps } from "./shared";

/** Letterbox bars, each this share of the height. */
const BAR = 0.12;

/**
 * Widescreen: black bars top and bottom, big type in the middle, a slow
 * crossfade between sections. Meant to fill the whole ending scene.
 */
export function CreditsCinematic({ sections, cfg, playback }: CreditsPresetProps) {
  const big = { ...cfg, fontSize: Math.round(cfg.fontSize * 1.6) };
  const bar = (edge: "top" | "bottom") => (
    <div
      aria-hidden
      className="sw-credits-motion"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        [edge]: 0,
        height: `${BAR * 100}%`,
        background: "#000",
        transformOrigin: edge === "top" ? "top" : "bottom",
        animation: playback.idle ? undefined : "sw-credits-bars 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
      }}
    />
  );
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: cfg.backgroundOpacity > 0 ? hexToRgba(cfg.backgroundColor, cfg.backgroundOpacity) : undefined,
      }}
    >
      {bar("top")}
      {bar("bottom")}
      <StepStage
        sections={sections}
        stepIndex={playback.stepIndex}
        idle={playback.idle}
        animation="sw-credits-fade-in 1200ms ease-in-out both"
        style={{ top: `${BAR * 100}%`, bottom: `${BAR * 100}%`, padding: `0 ${Math.round(cfg.fontSize * 2)}px` }}
      >
        {(section) => (
          <div style={{ maxHeight: "100%", overflow: "hidden" }}>
            <SectionBlock section={section} cfg={big} gap={Math.round(big.fontSize * 0.3)} />
          </div>
        )}
      </StepStage>
    </div>
  );
}
