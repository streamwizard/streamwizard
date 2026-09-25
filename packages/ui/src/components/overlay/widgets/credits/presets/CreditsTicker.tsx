"use client";

import { Fragment } from "react";
import { ScrollStage, StepStage, headingStyle, headingText, nameStyle, plateStyle, valueStyle, type CreditsPresetProps } from "./shared";

/**
 * One line along the bottom: `NEW FOLLOWERS · 12   sandwichlord, ninetoad, …
 * RAIDS   grumpycatto · 42 viewers`, sliding right to left. Made for a strip
 * over the ending scene, not a full screen.
 */
export function CreditsTicker({ sections, cfg, playback, contentRef }: CreditsPresetProps) {
  const heading = { ...headingStyle(cfg, 0.75), whiteSpace: "nowrap" as const };
  const name = { ...nameStyle(cfg), whiteSpace: "nowrap" as const };
  const gapSection = Math.round(cfg.fontSize * 2.2);
  const gapInner = Math.round(cfg.fontSize * 0.6);

  const line = (section: (typeof sections)[number]) => {
    if (section.kind === "title" || section.kind === "outro") {
      return <span style={{ ...name, fontWeight: 700 }}>{section.label}</span>;
    }
    return (
      <>
        <span style={heading}>{headingText(section)}</span>
        {section.kind === "stat" && <span style={name}>{section.stat}</span>}
        {section.kind === "text" && <span style={name}>{section.text.replace(/\s+/g, " ")}</span>}
        {section.kind === "names" && (
          <span style={name}>
            {section.names.map((entry, i) => (
              <Fragment key={entry.key}>
                {i > 0 && <span style={{ opacity: 0.5 }}>, </span>}
                {entry.name}
                {entry.valueText && <span style={valueStyle(cfg)}> {entry.valueText}</span>}
              </Fragment>
            ))}
            {section.overflowText && <span style={{ ...valueStyle(cfg), fontStyle: "italic" }}> {section.overflowText}</span>}
          </span>
        )}
      </>
    );
  };

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...plateStyle(cfg) }}>
      {playback.mode === "scroll" ? (
        <ScrollStage contentRef={contentRef} offsetPx={playback.offsetPx} idle={playback.idle} horizontal gap={gapSection} padding={`0 ${gapInner}px`}>
          {sections.map((section, i) => (
            <div key={`${section.id}-${i}`} style={{ display: "flex", alignItems: "center", gap: gapInner, flexShrink: 0 }}>
              {line(section)}
            </div>
          ))}
        </ScrollStage>
      ) : (
        <StepStage sections={sections} stepIndex={playback.stepIndex} idle={playback.idle} style={{ padding: `0 ${gapInner}px` }}>
          {(section) => (
            <div style={{ display: "flex", alignItems: "center", gap: gapInner, maxWidth: "100%", overflow: "hidden" }}>{line(section)}</div>
          )}
        </StepStage>
      )}
    </div>
  );
}
