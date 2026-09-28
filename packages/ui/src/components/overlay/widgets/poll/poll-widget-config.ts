import {
  DEFAULT_GOOGLE_FONT_FAMILY,
  isValidGoogleFontFamilyName,
  type GoogleFontFamily,
} from "../../types";

/**
 * Shows the channel's Twitch poll: the question, each choice's share as votes
 * come in, a countdown, and the winner when it closes. Polls are started on
 * Twitch (Stream Manager or /poll in chat); the widget only shows them.
 */
export const POLL_WIDGET_TYPE = "poll_widget" as const;
export type PollWidgetType = typeof POLL_WIDGET_TYPE;

/** Twitch allows 2 to 5 choices. */
export const POLL_MAX_CHOICES = 5;

// ─── Designs ────────────────────────────────────────────────────────────────

export const POLL_WIDGET_PRESETS = ["bars", "columns", "donut", "strip", "race"] as const;
export type PollWidgetPreset = (typeof POLL_WIDGET_PRESETS)[number];

export const POLL_WIDGET_PRESET_LABELS: Record<PollWidgetPreset, string> = {
  bars: "Bars",
  columns: "Columns",
  donut: "Donut",
  strip: "Strip",
  race: "Race",
};

/** The box a preset is drawn for. Picking a preset resizes the widget to it. */
export const POLL_WIDGET_PRESET_SIZES: Record<PollWidgetPreset, { w: number; h: number }> = {
  bars: { w: 520, h: 300 },
  columns: { w: 520, h: 320 },
  donut: { w: 520, h: 260 },
  strip: { w: 640, h: 56 },
  race: { w: 600, h: 300 },
};

/**
 * Palette: every choice its own colour. Leader: the leading choice in one
 * colour and the rest muted, for a calmer look.
 */
export const POLL_WIDGET_COLOR_MODES = ["palette", "leader"] as const;
export type PollWidgetColorMode = (typeof POLL_WIDGET_COLOR_MODES)[number];

/** What plays when the poll closes with a winner. */
export const POLL_WIDGET_CELEBRATIONS = ["none", "glow", "confetti"] as const;
export type PollWidgetCelebration = (typeof POLL_WIDGET_CELEBRATIONS)[number];

export const POLL_WIDGET_ANIMATIONS_IN = ["none", "fade", "slide_up", "pop"] as const;
export type PollWidgetAnimationIn = (typeof POLL_WIDGET_ANIMATIONS_IN)[number];

export const POLL_WIDGET_ANIMATIONS_OUT = ["none", "fade", "slide_down", "shrink"] as const;
export type PollWidgetAnimationOut = (typeof POLL_WIDGET_ANIMATIONS_OUT)[number];

export const POLL_WIDGET_LIMITS = {
  title: 80,
  fontSize: { min: 10, max: 64 },
  radius: { min: 0, max: 48 },
  hideAfterSeconds: { min: 3, max: 60 },
} as const;

/** Wizard purple and the brand pink and amber first, then two that sit well beside them. */
export const POLL_DEFAULT_CHOICE_COLORS = ["#9e7aff", "#fe8bbb", "#ffbd7a", "#5ec8ff", "#7be0a8"] as const;

export interface PollWidgetItemConfig {
  preset: PollWidgetPreset;
  /** Empty = use the poll's own question from Twitch. */
  title: string;
  showTitle: boolean;
  /** Each choice's vote count. */
  showVotes: boolean;
  showPercent: boolean;
  /** Countdown while the poll runs. */
  showTimer: boolean;
  colorMode: PollWidgetColorMode;
  /** One per choice slot, in Twitch's choice order. Always 5 long. */
  choiceColors: string[];
  leaderColor: string;
  otherColor: string;
  fontFamily: GoogleFontFamily;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  textColor: string;
  textShadow: boolean;
  trackColor: string;
  trackOpacity: number;
  /** Capped at half an element's height when drawn, so a high value makes a pill. */
  radius: number;
  /** A short flash on a choice each time its votes go up. */
  pulseOnVote: boolean;
  celebration: PollWidgetCelebration;
  /** How long the result stays up after the poll closes. */
  hideAfterSeconds: number;
  animationIn: PollWidgetAnimationIn;
  animationOut: PollWidgetAnimationOut;
}

export function createDefaultPollWidgetConfig(): PollWidgetItemConfig {
  return {
    preset: "bars",
    title: "",
    showTitle: true,
    showVotes: false,
    showPercent: true,
    showTimer: true,
    colorMode: "palette",
    choiceColors: [...POLL_DEFAULT_CHOICE_COLORS],
    leaderColor: "#9e7aff",
    otherColor: "#6b6b80",
    fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
    fontSize: 20,
    fontWeight: 600,
    textColor: "#ffffff",
    textShadow: true,
    trackColor: "#0b0b12",
    trackOpacity: 0.7,
    radius: 12,
    pulseOnVote: true,
    celebration: "glow",
    hideAfterSeconds: 10,
    animationIn: "fade",
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

function clampInt(value: unknown, { min, max }: { min: number; max: number }, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Fills gaps and clamps a stored config, so a partial or old row still renders. */
export function normalizePollWidgetConfig(raw: unknown): PollWidgetItemConfig {
  const d = createDefaultPollWidgetConfig();
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof PollWidgetItemConfig, unknown>>;
  const stored = Array.isArray(c.choiceColors) ? c.choiceColors : [];
  return {
    preset: oneOf(c.preset, POLL_WIDGET_PRESETS, d.preset),
    title: typeof c.title === "string" ? c.title.slice(0, POLL_WIDGET_LIMITS.title) : d.title,
    showTitle: bool(c.showTitle, d.showTitle),
    showVotes: bool(c.showVotes, d.showVotes),
    showPercent: bool(c.showPercent, d.showPercent),
    showTimer: bool(c.showTimer, d.showTimer),
    colorMode: oneOf(c.colorMode, POLL_WIDGET_COLOR_MODES, d.colorMode),
    choiceColors: d.choiceColors.map((fallback, i) => color(stored[i], fallback)),
    leaderColor: color(c.leaderColor, d.leaderColor),
    otherColor: color(c.otherColor, d.otherColor),
    fontFamily:
      typeof c.fontFamily === "string" && isValidGoogleFontFamilyName(c.fontFamily)
        ? c.fontFamily.trim()
        : d.fontFamily,
    fontSize: clampInt(c.fontSize, POLL_WIDGET_LIMITS.fontSize, d.fontSize),
    fontWeight: ([400, 500, 600, 700] as const).includes(c.fontWeight as 400)
      ? (c.fontWeight as PollWidgetItemConfig["fontWeight"])
      : d.fontWeight,
    textColor: color(c.textColor, d.textColor),
    textShadow: bool(c.textShadow, d.textShadow),
    trackColor: color(c.trackColor, d.trackColor),
    trackOpacity:
      typeof c.trackOpacity === "number" && Number.isFinite(c.trackOpacity)
        ? Math.min(1, Math.max(0, c.trackOpacity))
        : d.trackOpacity,
    radius: clampInt(c.radius, POLL_WIDGET_LIMITS.radius, d.radius),
    pulseOnVote: bool(c.pulseOnVote, d.pulseOnVote),
    celebration: oneOf(c.celebration, POLL_WIDGET_CELEBRATIONS, d.celebration),
    hideAfterSeconds: clampInt(c.hideAfterSeconds, POLL_WIDGET_LIMITS.hideAfterSeconds, d.hideAfterSeconds),
    animationIn: oneOf(c.animationIn, POLL_WIDGET_ANIMATIONS_IN, d.animationIn),
    animationOut: oneOf(c.animationOut, POLL_WIDGET_ANIMATIONS_OUT, d.animationOut),
  };
}
