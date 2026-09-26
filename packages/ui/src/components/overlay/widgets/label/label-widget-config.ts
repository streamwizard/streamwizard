import { LABEL_CATALOG, LABEL_PERIODS, DEFAULT_LABEL_ID, getLabelDefinition, type LabelPeriod } from "@repo/schemas";
import {
  DEFAULT_GOOGLE_FONT_FAMILY,
  isValidGoogleFontFamilyName,
  type GoogleFontFamily,
} from "../../types";

/**
 * One label: latest follower, top cheerer, session bits, the event list, ...
 * Which one is `labelId`, an id from LABEL_CATALOG in @repo/schemas. Values
 * come from one snapshot per scene (GET /api/twitch/labels) and the raw
 * events the overlay room already delivers; see use-stream-labels.ts.
 */
export const LABEL_WIDGET_TYPE = "label_widget" as const;
export type LabelWidgetType = typeof LABEL_WIDGET_TYPE;

export const LABEL_WIDGET_LAYOUTS = ["inline", "stacked"] as const;
export type LabelWidgetLayout = (typeof LABEL_WIDGET_LAYOUTS)[number];

export const LABEL_WIDGET_DIRECTIONS = ["vertical", "horizontal"] as const;
export type LabelWidgetDirection = (typeof LABEL_WIDGET_DIRECTIONS)[number];

/** How a new value comes in. Plays when the value changes, never on page load. */
export const LABEL_WIDGET_ANIMATIONS = [
  "none",
  "pop",
  "fade",
  "slide_up",
  "slide_side",
  "bounce",
  "typewriter",
  "glow",
] as const;
export type LabelWidgetAnimation = (typeof LABEL_WIDGET_ANIMATIONS)[number];

export const LABEL_WIDGET_ANIMATION_LABELS: Record<LabelWidgetAnimation, string> = {
  none: "None",
  pop: "Pop",
  fade: "Fade in",
  slide_up: "Slide up",
  slide_side: "Slide in from the side",
  bounce: "Drop and bounce",
  typewriter: "Typewriter",
  glow: "Glow",
};

/** Browser event the settings' Preview button dispatches to replay the animation. */
export const LABEL_ANIMATE_PREVIEW_EVENT = "streamwizard:label-animate-preview";
export interface LabelAnimatePreviewDetail {
  itemId: string;
}

export const LABEL_WIDGET_LIMITS = {
  prefix: 60,
  template: 120,
  emptyText: 60,
  separator: 8,
  count: { min: 1, max: 25 },
  fontSize: { min: 10, max: 120 },
  marqueeSpeed: { min: 10, max: 300 },
  animationDuration: { min: 150, max: 2000 },
} as const;

export const LABEL_WIDGET_IDS = LABEL_CATALOG.map((d) => d.id);

export interface LabelWidgetItemConfig {
  /** A LABEL_CATALOG id. */
  labelId: string;
  /** Time filter, for labels that have one (see LabelDefinition.defaultPeriod). */
  period: LabelPeriod;
  /** Text per entry with {name} {amount} {tier} {months} {message} {reward} {event}. Empty = the label's default. */
  template: string;
  /** Words before the value ("Latest follower"). Empty shows the value alone. */
  prefix: string;
  /** Prefix beside the value, or above it. */
  layout: LabelWidgetLayout;
  /** Shown when there's nothing yet. Empty hides the widget on the overlay. */
  emptyText: string;
  /** List and leaderboard labels. */
  count: number;
  direction: LabelWidgetDirection;
  /** Between entries in a horizontal list. */
  separator: string;
  /** Horizontal lists scroll like a ticker. */
  marquee: boolean;
  /** Pixels per second. */
  marqueeSpeed: number;
  /** How a new name or number comes in. */
  animation: LabelWidgetAnimation;
  /** Milliseconds. */
  animationDuration: number;
  fontFamily: GoogleFontFamily;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  color: string;
  prefixColor: string;
  align: "left" | "center" | "right";
  textShadow: boolean;
}

export function createDefaultLabelWidgetConfig(): LabelWidgetItemConfig {
  return {
    labelId: DEFAULT_LABEL_ID,
    period: getLabelDefinition(DEFAULT_LABEL_ID).defaultPeriod ?? "all",
    template: "",
    prefix: "Latest follower",
    layout: "inline",
    emptyText: "",
    count: 5,
    direction: "vertical",
    separator: "•",
    marquee: false,
    marqueeSpeed: 60,
    animation: "pop",
    animationDuration: 500,
    fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
    fontSize: 28,
    fontWeight: 600,
    color: "#ffffff",
    prefixColor: "#c4b5fd",
    align: "center",
    textShadow: true,
  };
}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function text(value: unknown, max: number, fallback: string): string {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

function clamp(value: unknown, range: { min: number; max: number }, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.round(Math.min(range.max, Math.max(range.min, n)));
}

/** Fills gaps and clamps a stored config, so a partial or old row still renders. */
export function normalizeLabelWidgetConfig(raw: unknown): LabelWidgetItemConfig {
  const d = createDefaultLabelWidgetConfig();
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof LabelWidgetItemConfig, unknown>>;
  const L = LABEL_WIDGET_LIMITS;
  const labelId = oneOf(c.labelId, LABEL_WIDGET_IDS, d.labelId);
  return {
    labelId,
    period: oneOf(c.period, LABEL_PERIODS, getLabelDefinition(labelId).defaultPeriod ?? "all"),
    template: text(c.template, L.template, d.template),
    prefix: text(c.prefix, L.prefix, d.prefix),
    layout: oneOf(c.layout, LABEL_WIDGET_LAYOUTS, d.layout),
    emptyText: text(c.emptyText, L.emptyText, d.emptyText),
    count: clamp(c.count, L.count, d.count),
    direction: oneOf(c.direction, LABEL_WIDGET_DIRECTIONS, d.direction),
    separator: text(c.separator, L.separator, d.separator),
    marquee: bool(c.marquee, d.marquee),
    marqueeSpeed: clamp(c.marqueeSpeed, L.marqueeSpeed, d.marqueeSpeed),
    // Rows from before the animation picker stored a plain on/off switch.
    animation: oneOf(
      c.animation,
      LABEL_WIDGET_ANIMATIONS,
      (c as { animateChanges?: unknown }).animateChanges === false ? "none" : d.animation,
    ),
    animationDuration: clamp(c.animationDuration, L.animationDuration, d.animationDuration),
    fontFamily:
      typeof c.fontFamily === "string" && isValidGoogleFontFamilyName(c.fontFamily)
        ? c.fontFamily.trim()
        : d.fontFamily,
    fontSize: clamp(c.fontSize, L.fontSize, d.fontSize),
    fontWeight: ([400, 500, 600, 700] as const).includes(c.fontWeight as 400)
      ? (c.fontWeight as LabelWidgetItemConfig["fontWeight"])
      : d.fontWeight,
    color: color(c.color, d.color),
    prefixColor: color(c.prefixColor, d.prefixColor),
    align: oneOf(c.align, ["left", "center", "right"] as const, d.align),
    textShadow: bool(c.textShadow, d.textShadow),
  };
}

/** The template in use: the author's, or the label's own default. */
export function effectiveLabelTemplate(cfg: LabelWidgetItemConfig): string {
  return cfg.template.trim() || getLabelDefinition(cfg.labelId).template;
}
