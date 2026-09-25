"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { hexToRgba, textStyle } from "../../goal/presets/shared";
import {
  CREDITS_SOCIAL_BRAND_COLORS,
  type CreditsSocial,
  type CreditsSocialPlatform,
  type CreditsWidgetItemConfig,
} from "../credits-widget-config";
import type { CreditsViewName, CreditsViewSection } from "../credits-view";
import type { CreditsPlaybackMode } from "../credits-playback";

import { FitText } from "../../goal/presets/shared";
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
  /** Hybrid only: the hero cards that play before the roll. */
  hero?: {
    sections: CreditsViewSection[];
    /** The card that's up, or -1 once they're done. */
    index: number;
    holdMs: number;
    fadeMs: number;
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
@keyframes sw-credits-fade-out { from { opacity: 1 } to { opacity: 0 } }
@keyframes sw-credits-hero-in { from { opacity: 0; transform: scale(0.96) } to { opacity: 1; transform: none } }
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
 * Brand logos, one path each, from Simple Icons (CC0). Inline because the
 * overlay's CSP allows no logo CDN, and a data URL would need the same
 * bytes anyway.
 */
const SOCIAL_PATHS: Record<CreditsSocialPlatform, string> = {
  instagram:
    "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077",
  tiktok:
    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  youtube:
    "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  twitch:
    "M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z",
  x:
    "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  kick:
    "M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z",
  discord:
    "M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z",
  bluesky:
    "M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z",
};

/** The colour a platform's logo takes: its brand colour, or the accent when brand colours are off. */
export function socialIconColor(platform: CreditsSocialPlatform, cfg: CreditsWidgetItemConfig): string {
  if (!cfg.socialsBrandColors) return cfg.accentColor;
  // Black-on-white brands (TikTok, X) take the text colour, so they stay visible over dark footage.
  return CREDITS_SOCIAL_BRAND_COLORS[platform] ?? cfg.textColor;
}

export function SocialIcon({ platform, size, color }: { platform: CreditsSocialPlatform; size: number; color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      style={{ width: size, height: size, flexShrink: 0, display: "block", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.7))" }}
    >
      <path fill={color} d={SOCIAL_PATHS[platform]} />
    </svg>
  );
}

/** One platform: logo, then the handle as typed. */
export function SocialRow({ entry, cfg, style }: { entry: CreditsSocial; cfg: CreditsWidgetItemConfig; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: Math.round(cfg.fontSize * 0.4), minWidth: 0, ...nameStyle(cfg), ...style }}>
      <SocialIcon platform={entry.platform} size={Math.round(cfg.fontSize * 1.05)} color={socialIconColor(entry.platform, cfg)} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.handle}</span>
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

  if (section.kind === "hero") {
    return <HeroCard section={section} cfg={cfg} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "left" ? "flex-start" : "center", gap: rowGap, textAlign }}>
      <div style={{ ...headingStyle(cfg), ...heading }}>{headingText(section)}</div>
      {section.kind === "stat" && <div style={{ ...big, fontSize: Math.round(cfg.fontSize * 1.8) }}>{section.stat}</div>}
      {section.kind === "text" && (
        <div style={{ ...nameStyle(cfg), whiteSpace: "pre-wrap", maxWidth: "36ch", opacity: 0.95 }}>{section.text}</div>
      )}
      {section.kind === "socials" &&
        (cfg.socialsLayout === "row" ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: align === "left" ? "flex-start" : "center",
              gap: `${Math.round(cfg.fontSize * 0.5)}px ${Math.round(cfg.fontSize * 0.9)}px`,
              maxWidth: "100%",
            }}
          >
            {section.socials.map((entry) => (
              <SocialRow key={entry.platform} entry={entry} cfg={cfg} />
            ))}
          </div>
        ) : (
          section.socials.map((entry) => <SocialRow key={entry.platform} entry={entry} cfg={cfg} />)
        ))}
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

/**
 * A hero card: the role in small caps, the name(s) big under it. Used by the
 * Hybrid design's opening, and by any stepped fallback that meets a `hero`
 * section.
 */
export function HeroCard({ section, cfg }: { section: CreditsViewSection; cfg: CreditsWidgetItemConfig }) {
  const big = Math.round(cfg.fontSize * (section.names.length > 1 ? 1.3 : 1.7));
  const gap = Math.round(cfg.fontSize * 0.5);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap, textAlign: "center", width: "100%", minWidth: 0 }}>
      <div style={{ ...headingStyle(cfg, 0.75), letterSpacing: "0.22em" }}>{section.label}</div>
      {section.names.map((entry) => (
        <div key={entry.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: Math.round(gap * 0.3), width: "100%", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: Math.round(cfg.fontSize * 0.4), width: "100%", minWidth: 0 }}>
            <Avatar src={entry.avatar} size={Math.round(big * 1.1)} />
            {/* The name shrinks to fit rather than being cut: a hero's name is the whole point. */}
            <FitText align="center" style={{ ...nameStyle(cfg), fontSize: big, fontWeight: 700, flex: "0 1 auto" }}>
              {entry.name}
            </FitText>
          </div>
          {entry.valueText && <div style={{ ...nameStyle(cfg), ...valueStyle(cfg), fontSize: Math.round(cfg.fontSize * 0.9) }}>{entry.valueText}</div>}
        </div>
      ))}
    </div>
  );
}
