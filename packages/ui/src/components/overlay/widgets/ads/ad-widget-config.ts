import {
  DEFAULT_GOOGLE_FONT_FAMILY,
  isValidGoogleFontFamilyName,
  type GoogleFontFamily,
} from "../../types";

/**
 * Tells viewers about ad breaks: a heads-up in the last minutes before one
 * (from Twitch's ad schedule), a countdown while it runs (from
 * channel.ad_break.begin), and an optional welcome back after.
 */
export const AD_WIDGET_TYPE = "ad_widget" as const;
export type AdWidgetType = typeof AD_WIDGET_TYPE;

export const AD_WIDGET_PRESETS = ["badge", "pill", "bar", "card", "ring"] as const;
export type AdWidgetPreset = (typeof AD_WIDGET_PRESETS)[number];

export const AD_WIDGET_PRESET_LABELS: Record<AdWidgetPreset, string> = {
  badge: "Badge",
  pill: "Pill",
  bar: "Bar",
  card: "Card",
  ring: "Ring",
};

/** The box a preset is drawn for. Picking a preset resizes the widget to it. */
export const AD_WIDGET_PRESET_SIZES: Record<AdWidgetPreset, { w: number; h: number }> = {
  badge: { w: 320, h: 80 },
  pill: { w: 380, h: 56 },
  bar: { w: 520, h: 80 },
  card: { w: 480, h: 200 },
  ring: { w: 220, h: 250 },
};

export const AD_WIDGET_ANIMATIONS_IN = ["none", "fade", "slide_up", "pop"] as const;
export type AdWidgetAnimationIn = (typeof AD_WIDGET_ANIMATIONS_IN)[number];

export const AD_WIDGET_ANIMATIONS_OUT = ["none", "fade", "slide_down", "shrink"] as const;
export type AdWidgetAnimationOut = (typeof AD_WIDGET_ANIMATIONS_OUT)[number];

export const AD_WIDGET_LIMITS = {
  text: 120,
  fontSize: { min: 10, max: 64 },
  radius: { min: 0, max: 48 },
  /** Minutes before the ad that the heads-up appears. */
  warnMinutes: { min: 0.5, max: 10 },
} as const;

/** Where the countdown goes in each line. */
export const AD_TIME_TOKEN = "{time}";

export interface AdWidgetItemConfig {
  preset: AdWidgetPreset;
  /** How long before a scheduled ad the heads-up shows, in minutes. */
  warnMinutes: number;
  /** The heads-up before an ad. */
  showWarning: boolean;
  /** The countdown while the ads run. */
  showRunning: boolean;
  /** A short line for a few seconds after the break. */
  showBackMessage: boolean;
  warningText: string;
  runningText: string;
  backText: string;
  /** Card only: the line under the countdown. Empty shows none. */
  cardMessage: string;
  showIcon: boolean;
  accentColor: string;
  trackColor: string;
  trackOpacity: number;
  textColor: string;
  radius: number;
  fontFamily: GoogleFontFamily;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  textShadow: boolean;
  animationIn: AdWidgetAnimationIn;
  animationOut: AdWidgetAnimationOut;
}

export function createDefaultAdWidgetConfig(): AdWidgetItemConfig {
  return {
    preset: "badge",
    warnMinutes: 2,
    showWarning: true,
    showRunning: true,
    showBackMessage: true,
    warningText: "Ads in {time}",
    runningText: "Back in {time}",
    backText: "Thanks for sticking around",
    cardMessage: "Stretch, grab a drink. Back soon.",
    showIcon: true,
    accentColor: "#fbbf24",
    trackColor: "#0b0b12",
    trackOpacity: 0.85,
    textColor: "#ffffff",
    radius: 16,
    fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
    fontSize: 22,
    fontWeight: 700,
    textShadow: true,
    animationIn: "slide_up",
    animationOut: "fade",
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

function clamp(value: unknown, { min, max }: { min: number; max: number }, fallback: number, round = true): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const v = Math.min(max, Math.max(min, value));
  return round ? Math.round(v) : v;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.slice(0, AD_WIDGET_LIMITS.text) : fallback;
}

/** Fills gaps and clamps a stored config, so a partial or old row still renders. */
export function normalizeAdWidgetConfig(raw: unknown): AdWidgetItemConfig {
  const d = createDefaultAdWidgetConfig();
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof AdWidgetItemConfig, unknown>>;
  return {
    preset: oneOf(c.preset, AD_WIDGET_PRESETS, d.preset),
    // Half-minute steps.
    warnMinutes: Math.round(clamp(c.warnMinutes, AD_WIDGET_LIMITS.warnMinutes, d.warnMinutes, false) * 2) / 2,
    showWarning: bool(c.showWarning, d.showWarning),
    showRunning: bool(c.showRunning, d.showRunning),
    showBackMessage: bool(c.showBackMessage, d.showBackMessage),
    warningText: text(c.warningText, d.warningText),
    runningText: text(c.runningText, d.runningText),
    backText: text(c.backText, d.backText),
    cardMessage: text(c.cardMessage, d.cardMessage),
    showIcon: bool(c.showIcon, d.showIcon),
    accentColor: color(c.accentColor, d.accentColor),
    trackColor: color(c.trackColor, d.trackColor),
    trackOpacity:
      typeof c.trackOpacity === "number" && Number.isFinite(c.trackOpacity)
        ? Math.min(1, Math.max(0, c.trackOpacity))
        : d.trackOpacity,
    textColor: color(c.textColor, d.textColor),
    radius: clamp(c.radius, AD_WIDGET_LIMITS.radius, d.radius),
    fontFamily:
      typeof c.fontFamily === "string" && isValidGoogleFontFamilyName(c.fontFamily)
        ? c.fontFamily.trim()
        : d.fontFamily,
    fontSize: clamp(c.fontSize, AD_WIDGET_LIMITS.fontSize, d.fontSize),
    fontWeight: ([400, 500, 600, 700] as const).includes(c.fontWeight as 400)
      ? (c.fontWeight as AdWidgetItemConfig["fontWeight"])
      : d.fontWeight,
    textShadow: bool(c.textShadow, d.textShadow),
    animationIn: oneOf(c.animationIn, AD_WIDGET_ANIMATIONS_IN, d.animationIn),
    animationOut: oneOf(c.animationOut, AD_WIDGET_ANIMATIONS_OUT, d.animationOut),
  };
}
