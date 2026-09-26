"use client";

import { ScrollStage, SectionBlock, StepStage, plateStyle, type CreditsPresetProps } from "./shared";

/**
 * The movie roll: one centred column that scrolls up from the bottom, section
 * headings in the accent colour, names under them.
 */
export function CreditsClassic({ sections, cfg, playback, contentRef }: CreditsPresetProps) {
  const gap = Math.round(cfg.fontSize * 1.6);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...plateStyle(cfg) }}>
      {playback.mode === "scroll" ? (
        <ScrollStage contentRef={contentRef} offsetPx={playback.offsetPx} idle={playback.idle} padding={`0 ${Math.round(cfg.fontSize)}px`} gap={gap}>
          {sections.map((section, i) => (
            <SectionBlock key={`${section.id}-${i}`} section={section} cfg={cfg} />
          ))}
        </ScrollStage>
      ) : (
        <StepStage sections={sections} stepIndex={playback.stepIndex} idle={playback.idle} style={{ padding: Math.round(cfg.fontSize) }}>
          {(section) => <SectionBlock section={section} cfg={cfg} />}
        </StepStage>
      )}
    </div>
  );
}
