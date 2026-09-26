"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type SVGProps } from "react";
import type { GoalWidgetCelebration, GoalWidgetItemConfig } from "../goal-widget-config";
import type { GoalIconKind, GoalView } from "../goal-view";

/** What every preset gets. */
export interface GoalPresetProps {
  view: GoalView;
  cfg: GoalWidgetItemConfig;
  /** Bumps each time the number goes up; keys the edge pulse so it replays. */
  pulseKey: number;
  /** Set while a completion celebration plays; keys the preset's own part of it. */
  celebrating: GoalCelebrationPlay | null;
}

export interface GoalCelebrationPlay {
  kind: GoalWidgetCelebration;
  key: number;
}

/**
 * Every keyframe the goal presets use, in one block, prefixed so they can't
 * collide with another widget's on the same scene.
 */
export const GOAL_KEYFRAMES = `
@keyframes sw-goal-pulse { 0% { opacity: 0.9; transform: scale(1) } 100% { opacity: 0; transform: scale(2.4) } }
@keyframes sw-goal-block-pulse { 0% { filter: brightness(1.8) } 100% { filter: brightness(1) } }
@keyframes sw-goal-ring-pulse { 0% { filter: drop-shadow(0 0 0 transparent) brightness(1.6) } 100% { filter: drop-shadow(0 0 0 transparent) brightness(1) } }
@keyframes sw-goal-shine { from { transform: translateX(-120%) skewX(-20deg) } to { transform: translateX(320%) skewX(-20deg) } }
@keyframes sw-goal-glow {
  0%, 100% { filter: drop-shadow(0 0 0 var(--sw-goal-glow)) }
  25%, 75% { filter: drop-shadow(0 0 14px var(--sw-goal-glow)) }
  50% { filter: drop-shadow(0 0 4px var(--sw-goal-glow)) }
}
@keyframes sw-goal-confetti {
  0% { opacity: 1; left: 50%; top: 50%; transform: rotate(0deg) }
  80% { opacity: 1 }
  100% { opacity: 0; left: var(--sw-x); top: var(--sw-y); transform: rotate(var(--sw-rot)) }
}
@keyframes sw-goal-levelup {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.6) }
  15%, 70% { opacity: 1; transform: translate(-50%, -50%) scale(1) }
  30%, 50% { opacity: 0.35 }
  40%, 60% { opacity: 1 }
}
@keyframes sw-goal-text-pop { 0% { transform: scale(1.18) } 100% { transform: scale(1) } }
@keyframes sw-goal-in-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes sw-goal-in-slide_up { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: none } }
@keyframes sw-goal-in-pop { 0% { opacity: 0; transform: scale(0.7) } 70% { opacity: 1; transform: scale(1.04) } 100% { opacity: 1; transform: scale(1) } }
@keyframes sw-goal-out-fade { from { opacity: 1 } to { opacity: 0 } }
@keyframes sw-goal-out-slide_down { from { opacity: 1; transform: none } to { opacity: 0; transform: translateY(24px) } }
@keyframes sw-goal-out-shrink { from { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(0.7) } }
@media (prefers-reduced-motion: reduce) {
  .sw-goal-motion { animation: none !important; transition: none !important; }
  .sw-goal-confetti, .sw-goal-shine, .sw-goal-pulse { display: none !important; }
}
`;

export const FILL_MS = 700;
export const FILL_EASE = "cubic-bezier(0.2, 0, 0, 1)";
export const CELEBRATION_MS = 2500;

export function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Blends two hex colours; `t` 0 is `a`, 1 is `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = Number.parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${m(ar!, br!)},${m(ag!, bg!)},${m(ab!, bb!)})`;
}

/** Fill paint: the solid colour, or the gradient running along `angle`. */
export function fillPaint(cfg: GoalWidgetItemConfig, angle = "90deg"): string {
  return cfg.fillMode === "gradient"
    ? `linear-gradient(${angle}, ${cfg.fillColor}, ${cfg.fillColor2})`
    : cfg.fillColor;
}

export function trackPaint(cfg: GoalWidgetItemConfig): string {
  return hexToRgba(cfg.trackColor, cfg.trackOpacity);
}

const SOFT_SHADOW = "0 1px 2px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.45)";

/** The text settings goal and poll widgets share. */
export type WidgetTextConfig = Pick<GoalWidgetItemConfig, "fontFamily" | "fontSize" | "fontWeight" | "textColor" | "textShadow">;

/** Font, colour and the shadow that keeps text readable over footage. */
export function textStyle(cfg: WidgetTextConfig, shadow = SOFT_SHADOW): CSSProperties {
  return {
    fontFamily: `"${cfg.fontFamily}", sans-serif`,
    fontSize: cfg.fontSize,
    fontWeight: cfg.fontWeight,
    color: cfg.textColor,
    textShadow: cfg.textShadow ? shadow : "none",
    lineHeight: 1.2,
    fontVariantNumeric: "tabular-nums",
  };
}

/** The side text a preset shows after the title, joined in the order streamers read it. */
export function statsText(view: GoalView, cfg: GoalWidgetItemConfig): string {
  const parts: string[] = [];
  if (cfg.showNumbers) parts.push(view.numbersText);
  if (cfg.showPercent) parts.push(view.percentText);
  return parts.join(" · ");
}

/** Heart for followers, star for subs, gem for Bits; or the streamer's own image. */
export function GoalIcon({
  kind,
  url,
  size,
  color,
}: {
  kind: GoalIconKind;
  url: string;
  size: number;
  color: string;
}) {
  const style: CSSProperties = { width: size, height: size, flexShrink: 0, display: "block" };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" style={{ ...style, objectFit: "contain" }} />;
  }
  const path =
    kind === "heart"
      ? "M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.4.8-1.3 2.3-2.4 4.4-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"
      : kind === "star"
        ? "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
        : "M6.5 3h11l4 5.5L12 21 2.5 8.5zM2.5 8.5h19M9 3l-1.5 5.5L12 21l4.5-12.5L15 3";
  return (
    <svg viewBox="0 0 24 24" style={style} aria-hidden>
      <path
        d={path}
        fill={kind === "gem" ? "none" : color}
        stroke={color}
        strokeWidth={kind === "gem" ? 1.8 : 0}
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.7))" }}
      />
    </svg>
  );
}

/**
 * A number that bumps every time `current` goes up. Presets key their pulse
 * element on it so the animation restarts. The first value never pulses.
 */
export function useProgressPulse(current: number, goalId: string, enabled: boolean): number {
  const [key, setKey] = useState(0);
  const last = useRef<{ id: string; current: number } | null>(null);
  useEffect(() => {
    const prev = last.current;
    last.current = { id: goalId, current };
    if (enabled && prev && prev.id === goalId && current > prev.current) setKey((k) => k + 1);
  }, [current, goalId, enabled]);
  return key;
}

/**
 * Starts a celebration when a goal becomes reached while the widget is on
 * screen: its number crossing the target, or a goal ending achieved just now.
 * A goal that was already reached when the page loaded doesn't celebrate; a
 * refresh isn't an achievement.
 */
export function useCelebration({
  reached,
  goalId,
  justEnded,
  kind,
  enabled,
}: {
  reached: boolean;
  goalId: string;
  /** channel.goal.end arrived a moment ago. */
  justEnded: boolean;
  kind: GoalWidgetCelebration;
  enabled: boolean;
}): GoalCelebrationPlay | null {
  const [play, setPlay] = useState<GoalCelebrationPlay | null>(null);
  const last = useRef<{ id: string; reached: boolean } | null>(null);
  useEffect(() => {
    const prev = last.current;
    last.current = { id: goalId, reached };
    if (!prev || !reached || !enabled) return;
    const crossed = prev.id === goalId && !prev.reached;
    const endedJustNow = prev.id !== goalId && justEnded;
    if (!crossed && !endedJustNow) return;
    setPlay((p) => ({ kind, key: (p?.key ?? 0) + 1 }));
  }, [reached, goalId, justEnded, kind, enabled]);
  useEffect(() => {
    if (!play) return;
    const id = setTimeout(() => setPlay(null), CELEBRATION_MS);
    return () => clearTimeout(id);
  }, [play]);
  return play;
}

/** A bright band sweeping across whatever fill it sits in. */
export function FillShine({ play }: { play: GoalCelebrationPlay | null }) {
  if (!play || play.kind !== "shine") return null;
  return (
    <span
      key={play.key}
      className="sw-goal-shine sw-goal-motion"
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        width: "35%",
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent)",
        animation: "sw-goal-shine 900ms ease-in-out 2",
        pointerEvents: "none",
      }}
    />
  );
}

/** A soft flash at the leading edge of a fill, replayed on each `pulseKey`. */
export function EdgePulse({ pulseKey, color, size }: { pulseKey: number; color: string; size: number }) {
  if (pulseKey === 0) return null;
  return (
    <span
      key={pulseKey}
      className="sw-goal-pulse sw-goal-motion"
      aria-hidden
      style={{
        position: "absolute",
        right: -size / 2,
        top: "50%",
        width: size,
        height: size,
        marginTop: -size / 2,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        animation: "sw-goal-pulse 650ms ease-out forwards",
        pointerEvents: "none",
      }}
    />
  );
}

const CONFETTI_PIECES = 26;

/** Deterministic pseudo-random, so a burst looks the same in the editor and on stream. */
function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** A burst from the middle of the widget that falls away inside its box. */
export function Confetti({ play, colors }: { play: GoalCelebrationPlay | null; colors: string[] }) {
  if (!play || play.kind !== "confetti") return null;
  return (
    <div
      key={play.key}
      className="sw-goal-confetti"
      aria-hidden
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}
    >
      {Array.from({ length: CONFETTI_PIECES }, (_, i) => {
        const angle = seeded(i, 1) * Math.PI * 2;
        // Percent of the widget box: out to its edges, then drifting down.
        const dist = 20 + seeded(i, 2) * 30;
        const w = 6 + seeded(i, 3) * 6;
        return (
          <span
            key={i}
            className="sw-goal-motion"
            style={
              {
                position: "absolute",
                left: "50%",
                top: "50%",
                width: w,
                height: w * 0.45,
                borderRadius: 1,
                background: colors[i % colors.length],
                "--sw-x": `${50 + Math.cos(angle) * dist}%`,
                "--sw-y": `${50 + Math.sin(angle) * dist + 25}%`,
                "--sw-rot": `${Math.round(seeded(i, 4) * 720 - 360)}deg`,
                animation: `sw-goal-confetti ${1400 + seeded(i, 5) * 900}ms cubic-bezier(0.1, 0.6, 0.3, 1) forwards`,
                animationDelay: `${seeded(i, 6) * 120}ms`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/**
 * How wide a row's numbers may get. With a title beside them they get most of
 * the row but leave the title some; alone they may take all of it.
 */
export function statsMaxWidth(withTitle: boolean): string {
  return withTitle ? "65%" : "100%";
}

/** Radius that never exceeds half the element, so large values read as a pill. */
export function capRadius(radius: number, height: number): number {
  return Math.min(radius, height / 2);
}

/**
 * One line of text that shrinks to fit its box instead of spilling out or
 * cutting off. Measures the text at full size and scales it down (never up).
 * The outer box takes the width it's given; `align` sets which edge the
 * shrunk text hugs.
 */
export function FitText({
  children,
  align = "left",
  style,
}: {
  children: ReactNode;
  align?: "left" | "center" | "right";
  style?: CSSProperties;
}) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLSpanElement | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      // offsetWidth ignores transforms, so this is the text's full-size width
      // even while it's scaled, and the editor's zoom doesn't skew it.
      const natural = inner.offsetWidth;
      const room = outer.clientWidth;
      setScale(natural > 0 && room > 0 ? Math.min(1, room / natural) : 1);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      style={{
        // Flex, not text-align: an overflowing line stays centred (or right-
        // aligned) in flex, so the scale's origin matches where the line sits.
        display: "flex",
        justifyContent: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        lineHeight: 1.2,
        ...style,
      }}
    >
      <span
        ref={innerRef}
        style={{
          flexShrink: 0,
          whiteSpace: "nowrap",
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: align === "left" ? "left center" : align === "right" ? "right center" : "center",
        }}
      >
        {children}
      </span>
    </div>
  );
}

/**
 * An SVG text line that shrinks to fit `maxWidth` user units. It measures
 * itself at `fontSize` once rendered (and again when a web font arrives)
 * and scales the size down if the line is wider than the room it has.
 */
export function FitSvgText({
  children,
  fontSize,
  maxWidth,
  style,
  ...rest
}: Omit<SVGProps<SVGTextElement>, "fontSize"> & { fontSize: number; maxWidth: number }) {
  const ref = useRef<SVGTextElement | null>(null);
  const [size, setSize] = useState(fontSize);
  const text = typeof children === "string" || typeof children === "number" ? String(children) : "";
  const family = style?.fontFamily;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      // Measure at the full size, then settle on the fitted one.
      el.style.fontSize = `${fontSize}px`;
      const length = el.getComputedTextLength();
      const fitted = length > maxWidth && length > 0 ? (fontSize * maxWidth) / length : fontSize;
      el.style.fontSize = `${fitted}px`;
      setSize(fitted);
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [text, fontSize, maxWidth, family]);

  return (
    <text ref={ref} {...rest} style={{ ...style, fontSize: size }}>
      {children}
    </text>
  );
}
