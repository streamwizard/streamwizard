import {
  DEFAULT_GOOGLE_FONT_FAMILY,
  resolvedTextWidgetFontFamily,
  type GoogleFontFamily,
  type OverlayItemConfig,
} from "../../types";
import type { ThirdPartyProvider } from "../../../chat/types";
import {
  DEFAULT_EMOTE_WIDGET_HIDDEN_USERS,
  EMOTE_WIDGET_EMOTE_PROVIDERS,
  normalizeEmoteCodes,
  normalizeEmoteWidgetHiddenUsers,
} from "../emote/emote-widget-config";

export const COMBO_WIDGET_TYPE = "combo_widget" as const;
export type ComboWidgetType = typeof COMBO_WIDGET_TYPE;

/**
 * How a combo keeps going. Time window: every message with the emote counts
 * while the last one was recent, whatever else is said in between. Back to
 * back: only messages in a row count, any other message breaks it.
 */
export const COMBO_WIDGET_MODES = ["time_window", "back_to_back"] as const;
export type ComboWidgetMode = (typeof COMBO_WIDGET_MODES)[number];

/** Unique: each chatter counts once per combo. Every: every message counts. */
export const COMBO_WIDGET_COUNT_MODES = ["unique", "every"] as const;
export type ComboWidgetCountMode = (typeof COMBO_WIDGET_COUNT_MODES)[number];

/**
 * Punch: big emote with the count beside it. Pill: compact, for a corner.
 * Stack: emote on top, huge count underneath, for the middle of the screen.
 */
export const COMBO_WIDGET_PRESETS = ["punch", "pill", "stack"] as const;
export type ComboWidgetPreset = (typeof COMBO_WIDGET_PRESETS)[number];

export const COMBO_WIDGET_PRESET_LABELS: Record<ComboWidgetPreset, string> = {
  punch: "Punch",
  pill: "Pill",
  stack: "Stack",
};

/** How several combos line up when more than one shows. */
export const COMBO_WIDGET_LAYOUTS = ["vertical", "horizontal"] as const;
export type ComboWidgetLayout = (typeof COMBO_WIDGET_LAYOUTS)[number];

export const COMBO_WIDGET_TEXT_TOKENS = ["count", "emote"] as const;

export const COMBO_WIDGET_LIMITS = {
  windowSeconds: { min: 2, max: 60 },
  threshold: { min: 2, max: 100 },
  maxCombos: { min: 1, max: 3 },
  lingerSeconds: { min: 0, max: 15 },
  emoteSize: { min: 24, max: 256 },
  fontSize: { min: 12, max: 160 },
  text: 40,
  milestones: 5,
  milestone: { min: 2, max: 10000 },
} as const;

/** Persisted JSON on `combo_widget` rows. */
export interface ComboWidgetItemConfig {
  mode: ComboWidgetMode;
  windowSeconds: number;
  /** A combo shows once it reaches this count. */
  threshold: number;
  countMode: ComboWidgetCountMode;
  maxCombos: number;
  /** Seconds the final count stays before it fades. */
  lingerSeconds: number;
  preset: ComboWidgetPreset;
  layout: ComboWidgetLayout;
  /** `{count}` and `{emote}` are filled in. */
  text: string;
  emoteSize: number;
  fontFamily: GoogleFontFamily;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  color: string;
  accentColor: string;
  /** Counts that get a bigger punch, ascending. */
  milestones: number[];
  textShadow: boolean;
  emoteProviders: Record<ThirdPartyProvider, boolean>;
  hiddenUsers: string[];
  hideCommands: boolean;
  blockedEmotes: string[];
}

export function createDefaultComboWidgetConfig(): ComboWidgetItemConfig {
  return {
    mode: "time_window",
    windowSeconds: 8,
    threshold: 3,
    countMode: "unique",
    maxCombos: 1,
    lingerSeconds: 3,
    preset: "punch",
    layout: "vertical",
    text: "x{count} COMBO",
    emoteSize: 72,
    fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
    fontSize: 44,
    fontWeight: 700,
    color: "#ffffff",
    accentColor: "#9e7aff",
    milestones: [10, 25, 50],
    textShadow: true,
    emoteProviders: { "7tv": true, bttv: true, ffz: true },
    hiddenUsers: [...DEFAULT_EMOTE_WIDGET_HIDDEN_USERS],
    hideCommands: true,
    blockedEmotes: [],
  };
}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const FONT_WEIGHTS = [400, 500, 600, 700] as const;

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function clampInt(value: unknown, { min, max }: { min: number; max: number }, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

/** Whole numbers in range, deduped, ascending, capped. */
export function normalizeComboMilestones(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const { min, max } = COMBO_WIDGET_LIMITS.milestone;
  const set = new Set<number>();
  for (const raw of value) {
    const n = typeof raw === "string" ? Number(raw) : raw;
    if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max) continue;
    set.add(n);
  }
  return [...set].sort((a, b) => a - b).slice(0, COMBO_WIDGET_LIMITS.milestones);
}

/** Coerce persisted / partial config to a complete, safe shape. */
export function normalizeComboWidgetConfig(
  config: OverlayItemConfig | Record<string, unknown> | null | undefined,
): ComboWidgetItemConfig {
  const base = createDefaultComboWidgetConfig();
  if (!config || typeof config !== "object") return base;
  const r = config as Partial<ComboWidgetItemConfig> & Record<string, unknown>;
  const providers = (r.emoteProviders ?? {}) as Partial<Record<ThirdPartyProvider, unknown>>;

  return {
    mode: oneOf(r.mode, COMBO_WIDGET_MODES, base.mode),
    windowSeconds: clampInt(r.windowSeconds, COMBO_WIDGET_LIMITS.windowSeconds, base.windowSeconds),
    threshold: clampInt(r.threshold, COMBO_WIDGET_LIMITS.threshold, base.threshold),
    countMode: oneOf(r.countMode, COMBO_WIDGET_COUNT_MODES, base.countMode),
    maxCombos: clampInt(r.maxCombos, COMBO_WIDGET_LIMITS.maxCombos, base.maxCombos),
    lingerSeconds: clampInt(r.lingerSeconds, COMBO_WIDGET_LIMITS.lingerSeconds, base.lingerSeconds),
    preset: oneOf(r.preset, COMBO_WIDGET_PRESETS, base.preset),
    layout: oneOf(r.layout, COMBO_WIDGET_LAYOUTS, base.layout),
    text: typeof r.text === "string" ? r.text.slice(0, COMBO_WIDGET_LIMITS.text) : base.text,
    emoteSize: clampInt(r.emoteSize, COMBO_WIDGET_LIMITS.emoteSize, base.emoteSize),
    fontFamily: resolvedTextWidgetFontFamily(r),
    fontSize: clampInt(r.fontSize, COMBO_WIDGET_LIMITS.fontSize, base.fontSize),
    fontWeight: FONT_WEIGHTS.includes(r.fontWeight as (typeof FONT_WEIGHTS)[number])
      ? (r.fontWeight as ComboWidgetItemConfig["fontWeight"])
      : base.fontWeight,
    color: color(r.color, base.color),
    accentColor: color(r.accentColor, base.accentColor),
    milestones: Array.isArray(r.milestones) ? normalizeComboMilestones(r.milestones) : base.milestones,
    textShadow: bool(r.textShadow, base.textShadow),
    emoteProviders: Object.fromEntries(
      EMOTE_WIDGET_EMOTE_PROVIDERS.map((p) => [p, bool(providers[p], base.emoteProviders[p])]),
    ) as Record<ThirdPartyProvider, boolean>,
    hiddenUsers: Array.isArray(r.hiddenUsers)
      ? normalizeEmoteWidgetHiddenUsers(r.hiddenUsers)
      : base.hiddenUsers,
    hideCommands: bool(r.hideCommands, base.hideCommands),
    blockedEmotes: normalizeEmoteCodes(r.blockedEmotes),
  };
}

/** Fills `{count}` and `{emote}`. */
export function formatComboText(template: string, count: number, emote: string): string {
  return template.replace(/\{count\}/g, String(count)).replace(/\{emote\}/g, emote);
}

/** How many milestones this count has passed, 0 when none. Drives the accent step-up. */
export function comboMilestoneLevel(count: number, milestones: readonly number[]): number {
  let level = 0;
  for (const m of milestones) if (count >= m) level++;
  return level;
}

/** Editor only: the settings panel's Preview button fires this to replay the animation. */
export const COMBO_PREVIEW_EVENT = "streamwizard:combo-preview";

export interface ComboPreviewDetail {
  itemId: string;
}
