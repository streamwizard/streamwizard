"use client";

import { NameRow, SectionBlock, StepStage, headingStyle, headingText, hexToRgba, nameStyle, valueStyle, type CreditsPresetProps } from "./shared";

/**
 * One section at a time on a rounded card that slides up into place. Long
 * name lists flow into columns so the card never grows past the box.
 */
export function CreditsCards({ sections, cfg, playback }: CreditsPresetProps) {
  const radius = Math.round(cfg.fontSize * 0.7);
  const pad = Math.round(cfg.fontSize * 1.2);
  const plate = hexToRgba(cfg.backgroundColor, cfg.backgroundOpacity > 0 ? cfg.backgroundOpacity : 0.75);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <StepStage
        sections={sections}
        stepIndex={playback.stepIndex}
        idle={playback.idle}
        animation="sw-credits-card-in 600ms cubic-bezier(0.2, 0.8, 0.2, 1) both"
        style={{ padding: Math.round(cfg.fontSize * 0.6) }}
      >
        {(section) => {
          const plain = section.kind === "title" || section.kind === "outro";
          const columns = section.kind === "names" && section.names.length > 8 ? (section.names.length > 16 ? 3 : 2) : 1;
          return (
            <div
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                boxSizing: "border-box",
                padding: pad,
                borderRadius: radius,
                background: plate,
                borderLeft: plain ? undefined : `${Math.max(3, Math.round(cfg.fontSize * 0.18))}px solid ${cfg.accentColor}`,
                boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
                overflow: "hidden",
              }}
            >
              {columns === 1 ? (
                <SectionBlock section={section} cfg={cfg} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: Math.round(cfg.fontSize * 0.5) }}>
                  <div style={{ ...headingStyle(cfg), textAlign: "center" }}>{headingText(section)}</div>
                  <div style={{ columnCount: columns, columnGap: pad }}>
                    {section.names.map((entry) => (
                      <div key={entry.key} style={{ breakInside: "avoid" }}>
                        <NameRow entry={entry} cfg={cfg} align="left" />
                      </div>
                    ))}
                  </div>
                  {section.overflowText && (
                    <div style={{ ...nameStyle(cfg), ...valueStyle(cfg), fontStyle: "italic", textAlign: "center" }}>{section.overflowText}</div>
                  )}
                </div>
              )}
            </div>
          );
        }}
      </StepStage>
    </div>
  );
}
