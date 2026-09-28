import {
  DEFAULT_GOOGLE_FONT_FAMILY,
  isValidGoogleFontFamilyName,
  type GoogleFontFamily,
} from "../../types";

// ─── Metrics ────────────────────────────────────────────────────────────────

/**
 * One widget per Twitch goal tab: followers, subs and Bits. The streamer makes the
 * goal on Twitch (Helix has no write endpoint for goals); the widget shows
 * the active one. Twitch runs one goal per tab at a time (a sub goal in one
 * of four kinds, a Bits goal counting Bits or cheerers), so each widget shows
 * whichever kind is running.
 */
export const GOAL_WIDGET_TYPES = ["follower_goal_widget", "sub_goal_widget", "bits_goal_widget"] as const;
export type GoalWidgetType = (typeof GOAL_WIDGET_TYPES)[number];

export function isGoalWidgetType(type: string): type is GoalWidgetType {
  return (GOAL_WIDGET_TYPES as readonly string[]).includes(type);
}

/** The `type` field on Get Creator Goals and the channel.goal.* events. */
export const TWITCH_GOAL_TYPES = [
  "follow",
  "subscription",
  "subscription_count",
  "new_subscription",
  "new_subscription_count",
  "new_bit",
  "new_cheerer",
] as const;
export type TwitchGoalType = (typeof TWITCH_GOAL_TYPES)[number];

/**
 * Twitch's own name for each goal kind (the Sub Count dropdown in Manage
 * Goals) and the unit the numbers are in. Points weight subs by tier: Prime
 * and tier 1 are 1, tier 2 is 2, tier 3 is 6. "New" kinds start at 0 and
 * ignore lapsed subs; "Total" kinds track the whole count. Bits goals start
 * at 0 and count Bits cheered, or unique cheerers, while the goal runs.
 */
export const TWITCH_GOAL_TYPE_LABELS: Record<TwitchGoalType, { name: string; unit: string; one: string }> = {
  follow: { name: "Followers", unit: "followers", one: "follower" },
  subscription_count: { name: "Total Subs", unit: "subs", one: "sub" },
  subscription: { name: "Total Sub Points", unit: "sub points", one: "sub point" },
  new_subscription_count: { name: "New Subs", unit: "subs", one: "sub" },
  new_subscription: { name: "New Sub Points", unit: "sub points", one: "sub point" },
  new_bit: { name: "Bits", unit: "Bits", one: "Bit" },
  new_cheerer: { name: "Cheerers", unit: "cheerers", one: "cheerer" },
};

export const GOAL_WIDGET_LABELS: Record<GoalWidgetType, { title: string; noun: string }> = {
  follower_goal_widget: { title: "Follower goal", noun: "follower" },
  sub_goal_widget: { title: "Sub goal", noun: "sub" },
  bits_goal_widget: { title: "Bits goal", noun: "Bits" },
};

const GOAL_TYPES_BY_WIDGET: Record<GoalWidgetType, TwitchGoalType[]> = {
  follower_goal_widget: ["follow"],
  sub_goal_widget: ["subscription_count", "subscription", "new_subscription_count", "new_subscription"],
  bits_goal_widget: ["new_bit", "new_cheerer"],
};

/** Which Twitch goal types a widget of this type shows. Twitch runs at most one at a time. */
export function twitchGoalTypesFor(type: GoalWidgetType): TwitchGoalType[] {
  return GOAL_TYPES_BY_WIDGET[type];
}

// ─── Config ─────────────────────────────────────────────────────────────────

/** Keep the finished bar on screen, or hide it a few seconds after the goal ends. */
export const GOAL_WIDGET_ON_END = ["keep", "hide"] as const;
export type GoalWidgetOnEnd = (typeof GOAL_WIDGET_ON_END)[number];

// ─── Designs ────────────────────────────────────────────────────────────────

/**
 * The looks a goal can take. Every preset draws the same data and shares the
 * text, fill and motion options; each has its own box shape.
 */
export const GOAL_WIDGET_PRESETS = ["text", "bar", "strip", "ring", "blocks", "tube", "arcade", "liquid"] as const;
export type GoalWidgetPreset = (typeof GOAL_WIDGET_PRESETS)[number];

export const GOAL_WIDGET_PRESET_LABELS: Record<GoalWidgetPreset, string> = {
  text: "Text",
  bar: "Bar",
  strip: "Strip",
  ring: "Ring",
  blocks: "Blocks",
  tube: "Tube",
  arcade: "Arcade",
  liquid: "Liquid",
};

/** The box a preset is drawn for. Picking a preset resizes the widget to it. */
export const GOAL_WIDGET_PRESET_SIZES: Record<GoalWidgetPreset, { w: number; h: number }> = {
  text: { w: 420, h: 150 },
  bar: { w: 600, h: 90 },
  strip: { w: 520, h: 48 },
  ring: { w: 260, h: 300 },
  blocks: { w: 600, h: 90 },
  tube: { w: 160, h: 420 },
  arcade: { w: 600, h: 110 },
  liquid: { w: 360, h: 200 },
};

/** Arcade reads as arcade because of its font; picking it switches to this one. */
export const GOAL_WIDGET_ARCADE_FONT = "Press Start 2P";

export const GOAL_WIDGET_FILL_MODES = ["solid", "gradient"] as const;
export type GoalWidgetFillMode = (typeof GOAL_WIDGET_FILL_MODES)[number];

/** What plays when a goal is reached. Arcade adds its LEVEL UP flash to any of them. */
export const GOAL_WIDGET_CELEBRATIONS = ["none", "shine", "glow", "confetti"] as const;
export type GoalWidgetCelebration = (typeof GOAL_WIDGET_CELEBRATIONS)[number];

export const GOAL_WIDGET_CELEBRATION_LABELS: Record<GoalWidgetCelebration, string> = {
  none: "None",
  shine: "Shine",
  glow: "Glow",
  confetti: "Confetti",
};

/** How the widget arrives when a goal starts. */
export const GOAL_WIDGET_ANIMATIONS_IN = ["none", "fade", "slide_up", "pop"] as const;
export type GoalWidgetAnimationIn = (typeof GOAL_WIDGET_ANIMATIONS_IN)[number];

/** How it leaves when a finished goal hides. */
export const GOAL_WIDGET_ANIMATIONS_OUT = ["none", "fade", "slide_down", "shrink"] as const;
export type GoalWidgetAnimationOut = (typeof GOAL_WIDGET_ANIMATIONS_OUT)[number];

export const GOAL_WIDGET_ANIMATION_LABELS: Record<GoalWidgetAnimationIn | GoalWidgetAnimationOut, string> = {
  none: "None",
  fade: "Fade",
  slide_up: "Slide up",
  slide_down: "Slide down",
  pop: "Pop",
  shrink: "Shrink",
};

export const GOAL_WIDGET_LIMITS = {
  title: 80,
  fontSize: { min: 10, max: 72 },
  radius: { min: 0, max: 48 },
  /** 0 = auto. */
  blockCount: { min: 0, max: 40 },
  iconUrl: 2048,
} as const;

export interface GoalWidgetItemConfig {
  preset: GoalWidgetPreset;
  /** Empty = use the goal's own description from Twitch. */
  title: string;
  showTitle: boolean;
  /** Current / target, followed by the unit (subs, sub points, followers). */
  showNumbers: boolean;
  showPercent: boolean;
  /** "12 subs to go", or "Goal reached" once it's done. */
  showRemaining: boolean;
  /** The metric's own icon (heart, star, gem), or `iconUrl` when set. */
  showIcon: boolean;
  iconUrl: string;
  onEnd: GoalWidgetOnEnd;
  fontFamily: GoogleFontFamily;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  textColor: string;
  textShadow: boolean;
  fillMode: GoalWidgetFillMode;
  fillColor: string;
  /** Gradient end colour. */
  fillColor2: string;
  trackColor: string;
  trackOpacity: number;
  /** Capped at half an element's height when drawn, so a high value makes a pill. */
  radius: number;
  /** Segments for Blocks; 0 picks one per unit for small targets, else 10. */
  blockCount: number;
  /** A short glow at the fill's edge each time the number goes up. */
  pulseOnProgress: boolean;
  celebration: GoalWidgetCelebration;
  animationIn: GoalWidgetAnimationIn;
  animationOut: GoalWidgetAnimationOut;
  /**
   * The font and radius from before Arcade swapped in its own, put back when
   * the streamer picks another design. Empty / -1 when there's nothing to put
   * back, including once they choose a font themselves while on Arcade.
   */
  arcadeRestoreFont: string;
  arcadeRestoreRadius: number;
}

export function createDefaultGoalWidgetConfig(): GoalWidgetItemConfig {
  return {
    preset: "text",
    title: "",
    showTitle: true,
    showNumbers: true,
    showPercent: false,
    showRemaining: false,
    showIcon: false,
    iconUrl: "",
    onEnd: "keep",
    fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
    fontSize: 22,
    fontWeight: 600,
    textColor: "#ffffff",
    textShadow: true,
    fillMode: "solid",
    fillColor: "#9e7aff",
    fillColor2: "#fe8bbb",
    trackColor: "#0b0b12",
    trackOpacity: 0.7,
    radius: 24,
    blockCount: 0,
    pulseOnProgress: true,
    celebration: "shine",
    animationIn: "fade",
    animationOut: "fade",
    arcadeRestoreFont: "",
    arcadeRestoreRadius: -1,
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
export function normalizeGoalWidgetConfig(raw: unknown): GoalWidgetItemConfig {
  const d = createDefaultGoalWidgetConfig();
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof GoalWidgetItemConfig, unknown>>;
  return {
    preset: oneOf(c.preset, GOAL_WIDGET_PRESETS, d.preset),
    title: typeof c.title === "string" ? c.title.slice(0, GOAL_WIDGET_LIMITS.title) : d.title,
    showTitle: bool(c.showTitle, d.showTitle),
    showNumbers: bool(c.showNumbers, d.showNumbers),
    showPercent: bool(c.showPercent, d.showPercent),
    showRemaining: bool(c.showRemaining, d.showRemaining),
    showIcon: bool(c.showIcon, d.showIcon),
    iconUrl:
      typeof c.iconUrl === "string" && c.iconUrl.length <= GOAL_WIDGET_LIMITS.iconUrl && /^https?:\/\//.test(c.iconUrl)
        ? c.iconUrl
        : d.iconUrl,
    onEnd: oneOf(c.onEnd, GOAL_WIDGET_ON_END, d.onEnd),
    fontFamily:
      typeof c.fontFamily === "string" && isValidGoogleFontFamilyName(c.fontFamily)
        ? c.fontFamily.trim()
        : d.fontFamily,
    fontSize: clampInt(c.fontSize, GOAL_WIDGET_LIMITS.fontSize, d.fontSize),
    fontWeight: ([400, 500, 600, 700] as const).includes(c.fontWeight as 400)
      ? (c.fontWeight as GoalWidgetItemConfig["fontWeight"])
      : d.fontWeight,
    textColor: color(c.textColor, d.textColor),
    textShadow: bool(c.textShadow, d.textShadow),
    fillMode: oneOf(c.fillMode, GOAL_WIDGET_FILL_MODES, d.fillMode),
    fillColor: color(c.fillColor, d.fillColor),
    fillColor2: color(c.fillColor2, d.fillColor2),
    trackColor: color(c.trackColor, d.trackColor),
    trackOpacity:
      typeof c.trackOpacity === "number" && Number.isFinite(c.trackOpacity)
        ? Math.min(1, Math.max(0, c.trackOpacity))
        : d.trackOpacity,
    radius: clampInt(c.radius, GOAL_WIDGET_LIMITS.radius, d.radius),
    blockCount: clampInt(c.blockCount, GOAL_WIDGET_LIMITS.blockCount, d.blockCount),
    pulseOnProgress: bool(c.pulseOnProgress, d.pulseOnProgress),
    celebration: oneOf(c.celebration, GOAL_WIDGET_CELEBRATIONS, d.celebration),
    animationIn: oneOf(c.animationIn, GOAL_WIDGET_ANIMATIONS_IN, d.animationIn),
    animationOut: oneOf(c.animationOut, GOAL_WIDGET_ANIMATIONS_OUT, d.animationOut),
    arcadeRestoreFont:
      typeof c.arcadeRestoreFont === "string" && isValidGoogleFontFamilyName(c.arcadeRestoreFont)
        ? c.arcadeRestoreFont.trim()
        : d.arcadeRestoreFont,
    arcadeRestoreRadius:
      c.arcadeRestoreRadius === -1 ? -1 : clampInt(c.arcadeRestoreRadius, GOAL_WIDGET_LIMITS.radius, d.arcadeRestoreRadius),
  };
}

/**
 * The config change for picking `next`. Arcade brings its pixel font and
 * square corners and remembers what was there; leaving Arcade puts them back,
 * unless the streamer picked a font themselves in the meantime.
 */
export function goalPresetChange(cfg: GoalWidgetItemConfig, next: GoalWidgetPreset): Partial<GoalWidgetItemConfig> {
  if (next === cfg.preset) return {};
  if (next === "arcade") {
    return {
      preset: next,
      fontFamily: GOAL_WIDGET_ARCADE_FONT,
      radius: 0,
      arcadeRestoreFont: cfg.fontFamily,
      arcadeRestoreRadius: cfg.radius,
    };
  }
  if (cfg.preset !== "arcade") return { preset: next };
  return {
    preset: next,
    ...(cfg.arcadeRestoreFont ? { fontFamily: cfg.arcadeRestoreFont } : {}),
    ...(cfg.arcadeRestoreRadius >= 0 ? { radius: cfg.arcadeRestoreRadius } : {}),
    arcadeRestoreFont: "",
    arcadeRestoreRadius: -1,
  };
}
