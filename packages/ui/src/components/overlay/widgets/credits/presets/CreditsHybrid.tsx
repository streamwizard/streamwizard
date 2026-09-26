"use client";

import { HeroCard, ScrollStage, SectionBlock, StepStage, plateStyle, type CreditsPresetProps } from "./shared";

/**
 * Film credits in two parts: the hero cards, each fading in, holding and
 * fading out in the middle of the box, then the classic roll for everyone
 * else, coming in from the bottom as the last card leaves. One timeline, so
 * looping runs the whole thing again in one motion.
 */
export function CreditsHybrid({ sections, cfg, playback, hero, contentRef }: CreditsPresetProps) {
  const gap = Math.round(cfg.fontSize * 1.6);
  const pad = Math.round(cfg.fontSize);

  // Reduced motion: every card and section, one after another.
  if (playback.mode === "step") {
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...plateStyle(cfg) }}>
        <StepStage sections={sections} stepIndex={playback.stepIndex} idle={playback.idle} style={{ padding: pad }}>
          {(section) => <SectionBlock section={section} cfg={cfg} />}
        </StepStage>
      </div>
    );
  }

  const card = hero && hero.index >= 0 ? hero.sections[hero.index] : undefined;
  // The editor's poster shows the first card when there is one, else the roll.
  const posterCard = playback.idle && hero && hero.sections.length > 0 ? hero.sections[0] : undefined;
  const shown = playback.idle ? posterCard : card;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...plateStyle(cfg) }}>
      <ScrollStage
        contentRef={contentRef}
        offsetPx={playback.offsetPx}
        idle={playback.idle && !posterCard}
        padding={`0 ${pad}px`}
        gap={gap}
        style={playback.idle && posterCard ? { visibility: "hidden" } : undefined}
      >
        {sections.map((section, i) => (
          <SectionBlock key={`${section.id}-${i}`} section={section} cfg={cfg} />
        ))}
      </ScrollStage>
      {shown && hero && (
        <div
          key={`${shown.id}-${hero.index}`}
          className="sw-credits-motion"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: pad,
            animation: playback.idle
              ? undefined
              : `sw-credits-hero-in ${hero.fadeMs}ms ease-out both, sw-credits-fade-out ${hero.fadeMs}ms ease-in ${hero.fadeMs + hero.holdMs}ms both`,
          }}
        >
          <HeroCard section={shown} cfg={cfg} />
        </div>
      )}
    </div>
  );
}
