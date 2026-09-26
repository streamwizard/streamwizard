"use client";

import type { CSSProperties } from "react";
import { ScrollStage, SectionBlock, StepStage, hexToRgba, plateStyle, type CreditsPresetProps } from "./shared";

/**
 * High-score table: pixel font, a square border, `>` bullets in the accent
 * colour and a faint scanline wash. Scrolls in whole pixels so the type stays
 * crisp.
 */
export function CreditsArcade({ sections, cfg, playback, contentRef }: CreditsPresetProps) {
  const border = Math.max(2, Math.round(cfg.fontSize * 0.12));
  const heading: CSSProperties = { letterSpacing: "0.05em", textTransform: "none" };
  const gap = Math.round(cfg.fontSize * 1.8);
  const pad = Math.round(cfg.fontSize * 0.9);

  // A `>` in front of every name and heading, the arcade menu's cursor.
  const bullets = sections.map((section) => ({
    ...section,
    label:
      section.kind === "names" || section.kind === "stat" || section.kind === "text" || section.kind === "socials"
        ? `> ${section.label}`
        : section.label,
  }));

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        boxSizing: "border-box",
        border: `${border}px solid ${cfg.accentColor}`,
        background: cfg.backgroundOpacity > 0 ? plateStyle(cfg).background : hexToRgba(cfg.backgroundColor, 0.55),
        imageRendering: "pixelated",
      }}
    >
      {playback.mode === "scroll" ? (
        <ScrollStage contentRef={contentRef} offsetPx={Math.round(playback.offsetPx)} idle={playback.idle} padding={`0 ${pad}px`} gap={gap}>
          {bullets.map((section, i) => (
            <SectionBlock key={`${section.id}-${i}`} section={section} cfg={cfg} heading={heading} gap={Math.round(cfg.fontSize * 0.5)} />
          ))}
        </ScrollStage>
      ) : (
        <StepStage sections={bullets} stepIndex={playback.stepIndex} idle={playback.idle} animation="sw-credits-blink 160ms steps(2) 2, sw-credits-fade-in 1ms both" style={{ padding: pad }}>
          {(section) => <SectionBlock section={section} cfg={cfg} heading={heading} gap={Math.round(cfg.fontSize * 0.5)} />}
        </StepStage>
      )}
      <div
        aria-hidden
        className="sw-credits-motion"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 2px, transparent 2px 6px)",
          backgroundSize: "100% 6px",
          animation: "sw-credits-scanline 900ms linear infinite",
          mixBlendMode: "multiply",
        }}
      />
    </div>
  );
}
