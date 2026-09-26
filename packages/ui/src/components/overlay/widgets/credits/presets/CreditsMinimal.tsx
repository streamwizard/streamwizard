"use client";

import { ScrollStage, SectionBlock, StepStage, plateStyle, type CreditsPresetProps } from "./shared";

/**
 * No chrome at all: a left-aligned column, small quiet headings, plain
 * names. Sits in a corner over the ending scene without asking for the room.
 */
export function CreditsMinimal({ sections, cfg, playback, contentRef }: CreditsPresetProps) {
  const heading = { fontWeight: 500 as const, letterSpacing: "0.18em", opacity: 0.85, fontSize: Math.round(cfg.fontSize * 0.6) };
  const gap = Math.round(cfg.fontSize * 1.4);
  const pad = Math.round(cfg.fontSize * 0.8);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...plateStyle(cfg) }}>
      {playback.mode === "scroll" ? (
        <ScrollStage contentRef={contentRef} offsetPx={playback.offsetPx} idle={playback.idle} padding={`0 ${pad}px`} gap={gap}>
          {sections.map((section, i) => (
            <SectionBlock key={`${section.id}-${i}`} section={section} cfg={cfg} align="left" heading={heading} gap={Math.round(cfg.fontSize * 0.25)} />
          ))}
        </ScrollStage>
      ) : (
        <StepStage sections={sections} stepIndex={playback.stepIndex} idle={playback.idle} style={{ justifyContent: "flex-start", padding: pad }}>
          {(section) => <SectionBlock section={section} cfg={cfg} align="left" heading={heading} />}
        </StepStage>
      )}
    </div>
  );
}
