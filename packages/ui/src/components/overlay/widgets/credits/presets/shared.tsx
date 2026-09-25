"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { hexToRgba, textStyle } from "../../goal/presets/shared";
import type { CreditsWidgetItemConfig } from "../credits-widget-config";
import type { CreditsViewName, CreditsViewSection } from "../credits-view";
import type { CreditsPlaybackMode } from "../credits-playback";

export { hexToRgba, mixHex, textStyle, FitText } from "../../goal/presets/shared";

/** What every design gets. */
export interface CreditsPresetProps {
  sections: CreditsViewSection[];
  cfg: CreditsWidgetItemConfig;
  playback: {
    mode: CreditsPlaybackMode;
    /** 0–1 through the roll. */
    progress: number;
    /** Step mode: the section that's up. -1 before the first. */
    stepIndex: number;
    /** Scroll mode: the content's offset along the scroll axis, in px. */
    offsetPx: number;
    /** True while the roll hasn't started (editor poster, or waiting for the start delay). */
    idle: boolean;
  };
  /** Attach to the element that scrolls, so its length can be measured. */
  contentRef: RefObject<HTMLDivElement | null>;
}

/**
 * Every keyframe the credits designs use, prefixed so they can't collide
 * with another widget's on the same scene.
 */
export const CREDITS_KEYFRAMES = `
@keyframes sw-credits-fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes sw-credits-rise { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }
@keyframes sw-credits-card-in { 0% { opacity: 0; transform: translateY(24px) scale(0.97) } 100% { opacity: 1; transform: none } }
@keyframes sw-credits-scanline { from { background-position: 0 0 } to { background-position: 0 6px } }
@keyframes sw-credits-bars { from { transform: scaleY(0) } to { transform: scaleY(1) } }
@keyframes sw-credits-blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
@media (prefers-reduced-motion: reduce) {
  .sw-credits-motion { animation: none !important; transition: none !important; }
}
`;

/** The plate behind the roll, or nothing when the opacity is 0. */
export function plateStyle(cfg: CreditsWidgetItemConfig): CSSProperties {
  return cfg.backgroundOpacity > 0 ? { background: hexToRgba(cfg.backgroundColor, cfg.backgroundOpacity) } : {};
}

/** The small caps heading over a section. */
export function headingStyle(cfg: CreditsWidgetItemConfig, scale = 0.7): CSSProperties {
  return {
    ...textStyle(cfg),
    color: cfg.accentColor,
    fontSize: Math.round(cfg.fontSize * scale),
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    fontWeight: 700,
  };
}

/** A name line, muted value after it. */
export function nameStyle(cfg: CreditsWidgetItemConfig): CSSProperties {
  return { ...textStyle(cfg), lineHeight: 1.3 };
}

export function valueStyle(cfg: CreditsWidgetItemConfig): CSSProperties {
  return { opacity: 0.7, fontWeight: 400, fontSize: Math.round(cfg.fontSize * 0.8) };
}

/** "New followers · 12" */
export function headingText(section: CreditsViewSection): string {
  return section.count !== null ? `${section.label} · ${section.count}` : section.label;
}

export function Avatar({ src, size }: { src?: string; size: number }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
    />
  );
}

/** One person: avatar (when on), name, value. */
export function NameRow({
  entry,
  cfg,
  align = "center",
  style,
}: {
  entry: CreditsViewName;
  cfg: CreditsWidgetItemConfig;
  align?: "left" | "center";
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: align === "left" ? "flex-start" : "center",
        gap: Math.round(cfg.fontSize * 0.4),
        minWidth: 0,
        ...nameStyle(cfg),
        ...style,
      }}
    >
      <Avatar src={entry.avatar} size={Math.round(cfg.fontSize * 1.1)} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</span>
      {entry.valueText && <span style={valueStyle(cfg)}>{entry.valueText}</span>}
    </div>
  );
}

/**
 * A section as most designs draw it: heading, then names (or the stat, the
 * note, or the one big line for title and outro). `align` sets the column.
 */
export function SectionBlock({
  section,
  cfg,
  align = "center",
  heading,
  gap,
}: {
  section: CreditsViewSection;
  cfg: CreditsWidgetItemConfig;
  align?: "left" | "center";
  /** Override the heading style (Arcade, Minimal). */
  heading?: CSSProperties;
  gap?: number;
}) {
  const textAlign = align;
  const big: CSSProperties = {
    ...textStyle(cfg),
    fontSize: Math.round(cfg.fontSize * 1.5),
    lineHeight: 1.15,
    textAlign,
  };
  const rowGap = gap ?? Math.round(cfg.fontSize * 0.35);

  if (section.kind === "title" || section.kind === "outro") {
    return <div style={big}>{section.label}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "left" ? "flex-start" : "center", gap: rowGap, textAlign }}>
      <div style={{ ...headingStyle(cfg), ...heading }}>{headingText(section)}</div>
      {section.kind === "stat" && <div style={{ ...big, fontSize: Math.round(cfg.fontSize * 1.8) }}>{section.stat}</div>}
      {section.kind === "text" && (
        <div style={{ ...nameStyle(cfg), whiteSpace: "pre-wrap", maxWidth: "36ch", opacity: 0.95 }}>{section.text}</div>
      )}
      {section.kind === "names" && (
        <>
          {section.names.map((entry) => (
            <NameRow key={entry.key} entry={entry} cfg={cfg} align={align} />
          ))}
          {section.overflowText && (
            <div style={{ ...nameStyle(cfg), ...valueStyle(cfg), fontStyle: "italic" }}>{section.overflowText}</div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Step mode: the section that's up, crossfading as the index changes. Used by
 * the stepped designs, and by the scrolling ones when motion is reduced.
 */
export function StepStage({
  sections,
  stepIndex,
  idle,
  animation = "sw-credits-fade-in 700ms ease-out both",
  style,
  children,
}: {
  sections: CreditsViewSection[];
  stepIndex: number;
  idle: boolean;
  animation?: string;
  style?: CSSProperties;
  children: (section: CreditsViewSection) => ReactNode;
}) {
  const index = idle ? 0 : Math.max(0, stepIndex);
  const section = sections[index];
  if (!section) return null;
  return (
    <div
      key={`${section.id}-${index}`}
      className="sw-credits-motion"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: idle ? undefined : animation,
        ...style,
      }}
    >
      {children(section)}
    </div>
  );
}

/**
 * Scroll mode: the whole roll in one column (or row), moved by `offsetPx`.
 * In the editor's idle state it sits at the top so the layout can be judged.
 */
export function ScrollStage({
  contentRef,
  offsetPx,
  idle,
  horizontal = false,
  padding,
  gap,
  children,
  style,
}: {
  contentRef: RefObject<HTMLDivElement | null>;
  offsetPx: number;
  idle: boolean;
  horizontal?: boolean;
  padding?: number | string;
  gap?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const offset = idle ? 0 : Math.round(offsetPx);
  return (
    <div
      ref={contentRef}
      style={{
        position: "absolute",
        ...(horizontal
          ? { left: 0, top: 0, height: "100%", display: "flex", alignItems: "center", flexDirection: "row" }
          : { left: 0, top: 0, width: "100%", display: "flex", flexDirection: "column" }),
        boxSizing: "border-box",
        padding,
        gap,
        transform: horizontal ? `translate3d(${offset}px, 0, 0)` : `translate3d(0, ${offset}px, 0)`,
        willChange: "transform",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
