import {
  DEFAULT_GOOGLE_FONT_FAMILY,
  resolvedTextWidgetFontFamily,
  type GoogleFontFamily,
  type OverlayItemConfig,
} from "../../types";

export const HYPE_TRAIN_WIDGET_TYPE = "hype_train_widget" as const;
export type HypeTrainWidgetType = typeof HYPE_TRAIN_WIDGET_TYPE;

/**
 * Steam: a classic locomotive with a smoking chimney. Neon: a sleek glowing
 * bullet train. Toy: a chunky wooden toy train in bright colours.
 */
export const HYPE_TRAIN_WIDGET_PRESETS = ["steam", "neon", "toy"] as const;
export type HypeTrainWidgetPreset = (typeof HYPE_TRAIN_WIDGET_PRESETS)[number];

export const HYPE_TRAIN_WIDGET_PRESET_LABELS: Record<HypeTrainWidgetPreset, string> = {
  steam: "Steam",
  neon: "Neon",
  toy: "Toy",
};

/**
 * Bounce: roams the whole widget at an angle and bounces off the edges, like
 * a DVD logo on standby, with the wagons following the engine's trail. Across:
 * crosses from one side to the other, again and again. Either way it keeps
 * going from the start of the hype train until it ends.
 */
export const HYPE_TRAIN_WIDGET_MOVEMENTS = ["bounce", "across"] as const;
export type HypeTrainWidgetMovement = (typeof HYPE_TRAIN_WIDGET_MOVEMENTS)[number];

/** Which way the train rides across. `ltr` enters on the left and leaves on the right. */
export const HYPE_TRAIN_WIDGET_DIRECTIONS = ["ltr", "rtl"] as const;
export type HypeTrainWidgetDirection = (typeof HYPE_TRAIN_WIDGET_DIRECTIONS)[number];

/**
 * How a new rider's wagon arrives. Drop: falls onto the track and bounces.
 * Chase: races up from behind and couples on. Pop: springs up from nothing.
 * Fade: fades in. None: just appears.
 */
export const HYPE_TRAIN_WIDGET_JOIN_EFFECTS = ["drop", "chase", "pop", "fade", "none"] as const;
export type HypeTrainWidgetJoinEffect = (typeof HYPE_TRAIN_WIDGET_JOIN_EFFECTS)[number];

export const HYPE_TRAIN_WIDGET_JOIN_EFFECT_LABELS: Record<HypeTrainWidgetJoinEffect, string> = {
  drop: "Drop in",
  chase: "Chase",
  pop: "Pop",
  fade: "Fade",
  none: "None",
};

export const HYPE_TRAIN_WIDGET_LIMITS = {
  /** Screen pixels per second. */
  speed: { min: 100, max: 1500 },
  /** Percent faster per level above 1. */
  speedPerLevel: { min: 0, max: 50 },
  /** However high the level, the train never goes faster than this, in px/s. */
  topSpeed: 3000,
  maxWagons: { min: 1, max: 50 },
  /** Train height on screen, in px. */
  trainSize: { min: 60, max: 400 },
} as const;

/** Persisted JSON on `hype_train_widget` rows. */
export interface HypeTrainWidgetItemConfig {
  preset: HypeTrainWidgetPreset;
  movement: HypeTrainWidgetMovement;
  /** Across only. */
  direction: HypeTrainWidgetDirection;
  trainSize: number;
  speed: number;
  /** Percent faster per level above 1; 0 keeps the same speed all train. */
  speedPerLevel: number;
  /** Riders past this share one last wagon: "+12 more". */
  maxWagons: number;
  joinEffect: HypeTrainWidgetJoinEffect;
  showAvatars: boolean;
  showAmounts: boolean;
  showLevel: boolean;
  fontFamily: GoogleFontFamily;
  /** Names and amounts. */
  color: string;
  /** The train's main paint. */
  trainColor: string;
  /** Trim, level number, glow. */
  accentColor: string;
}

export function createDefaultHypeTrainWidgetConfig(): HypeTrainWidgetItemConfig {
  return {
    preset: "steam",
    movement: "bounce",
    direction: "ltr",
    trainSize: 150,
    speed: 420,
    speedPerLevel: 15,
    joinEffect: "drop",
    maxWagons: 20,
    showAvatars: true,
    showAmounts: true,
    showLevel: true,
    fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
    color: "#ffffff",
    trainColor: "#7c5cff",
    accentColor: "#ffd166",
  };
}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

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

/** Coerce persisted / partial config to a complete, safe shape. */
export function normalizeHypeTrainWidgetConfig(
  config: OverlayItemConfig | Record<string, unknown> | null | undefined,
): HypeTrainWidgetItemConfig {
  const base = createDefaultHypeTrainWidgetConfig();
  if (!config || typeof config !== "object") return base;
  const r = config as Partial<HypeTrainWidgetItemConfig> & Record<string, unknown>;

  return {
    preset: oneOf(r.preset, HYPE_TRAIN_WIDGET_PRESETS, base.preset),
    movement: oneOf(r.movement, HYPE_TRAIN_WIDGET_MOVEMENTS, base.movement),
    direction: oneOf(r.direction, HYPE_TRAIN_WIDGET_DIRECTIONS, base.direction),
    trainSize: clampInt(r.trainSize, HYPE_TRAIN_WIDGET_LIMITS.trainSize, base.trainSize),
    speed: clampInt(r.speed, HYPE_TRAIN_WIDGET_LIMITS.speed, base.speed),
    speedPerLevel: clampInt(r.speedPerLevel, HYPE_TRAIN_WIDGET_LIMITS.speedPerLevel, base.speedPerLevel),
    maxWagons: clampInt(r.maxWagons, HYPE_TRAIN_WIDGET_LIMITS.maxWagons, base.maxWagons),
    joinEffect: oneOf(r.joinEffect, HYPE_TRAIN_WIDGET_JOIN_EFFECTS, base.joinEffect),
    showAvatars: bool(r.showAvatars, base.showAvatars),
    showAmounts: bool(r.showAmounts, base.showAmounts),
    showLevel: bool(r.showLevel, base.showLevel),
    fontFamily: resolvedTextWidgetFontFamily(r),
    color: color(r.color, base.color),
    trainColor: color(r.trainColor, base.trainColor),
    accentColor: color(r.accentColor, base.accentColor),
  };
}

/** How fast the train goes at this level, in px/s. */
export function hypeTrainSpeed(cfg: Pick<HypeTrainWidgetItemConfig, "speed" | "speedPerLevel">, level: number): number {
  const boost = 1 + (cfg.speedPerLevel / 100) * Math.max(0, level - 1);
  return Math.min(HYPE_TRAIN_WIDGET_LIMITS.topSpeed, Math.max(cfg.speed, cfg.speed * boost));
}

/** Editor only: the settings panel's Preview button fires this to run a short sample train. */
export const HYPE_TRAIN_PREVIEW_EVENT = "streamwizard:hype-train-preview";

export interface HypeTrainPreviewDetail {
  itemId: string;
}
