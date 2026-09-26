import { z } from "zod";
import {
  DEFAULT_GOOGLE_FONT_FAMILY,
  isValidGoogleFontFamilyName,
  CLIP_SORT_OPTIONS,
  CLIP_SOURCE_MODES,
  DISPLAY_FIELD_KEYS,
  TIME_WINDOW_PRESETS,
  type DisplayFieldKey,
} from "./components/overlay/types";
import {
  ALERT_EVENT_TYPES,
  type AlertEventType,
} from "./components/overlay/widgets/alert/alert-widget-config";
import {
  CHAT_WIDGET_ANIMATIONS_IN,
  CHAT_WIDGET_ANIMATIONS_OUT,
  CHAT_WIDGET_DIRECTIONS,
  CHAT_WIDGET_LAYOUTS,
  CHAT_WIDGET_LIMITS,
  CHAT_WIDGET_NAME_COLOR_MODES,
  CHAT_WIDGET_PRESETS,
  DEFAULT_CHAT_WIDGET_HIDDEN_USERS,
} from "./components/overlay/widgets/chat/chat-widget-config";
import {
  GOAL_WIDGET_ANIMATIONS_IN,
  GOAL_WIDGET_ANIMATIONS_OUT,
  GOAL_WIDGET_CELEBRATIONS,
  GOAL_WIDGET_FILL_MODES,
  GOAL_WIDGET_LIMITS,
  GOAL_WIDGET_ON_END,
  GOAL_WIDGET_PRESETS,
} from "./components/overlay/widgets/goal/goal-widget-config";
import {
  POLL_DEFAULT_CHOICE_COLORS,
  POLL_WIDGET_ANIMATIONS_IN,
  POLL_WIDGET_ANIMATIONS_OUT,
  POLL_WIDGET_CELEBRATIONS,
  POLL_WIDGET_COLOR_MODES,
  POLL_WIDGET_LIMITS,
  POLL_WIDGET_PRESETS,
} from "./components/overlay/widgets/poll/poll-widget-config";
import {
  AD_WIDGET_ANIMATIONS_IN,
  AD_WIDGET_ANIMATIONS_OUT,
  AD_WIDGET_LIMITS,
  AD_WIDGET_PRESETS,
} from "./components/overlay/widgets/ads/ad-widget-config";
import { UPTIME_WIDGET_LAYOUTS, UPTIME_WIDGET_LIMITS } from "./components/overlay/widgets/uptime/uptime-widget-config";
import { LABEL_PERIODS } from "@repo/schemas";
import {
  LABEL_WIDGET_ANIMATIONS,
  LABEL_WIDGET_DIRECTIONS,
  LABEL_WIDGET_IDS,
  LABEL_WIDGET_LAYOUTS,
  LABEL_WIDGET_LIMITS,
} from "./components/overlay/widgets/label/label-widget-config";
import {
  EMOTE_ANIMATIONS,
  EMOTE_WIDGET_LIMITS,
  DEFAULT_EMOTE_WIDGET_BURSTS,
  DEFAULT_EMOTE_WIDGET_HIDDEN_USERS,
  EMOTE_WIDGET_EVENTS,
  createDefaultEmoteWidgetConfig,
  type EmoteWidgetEvent,
} from "./components/overlay/widgets/emote/emote-widget-config";
import {
  COMBO_WIDGET_COUNT_MODES,
  COMBO_WIDGET_LAYOUTS,
  COMBO_WIDGET_LIMITS,
  COMBO_WIDGET_MODES,
  COMBO_WIDGET_PRESETS,
} from "./components/overlay/widgets/combo/combo-widget-config";
import {
  HYPE_TRAIN_WIDGET_DIRECTIONS,
  HYPE_TRAIN_WIDGET_JOIN_EFFECTS,
  HYPE_TRAIN_WIDGET_LIMITS,
  HYPE_TRAIN_WIDGET_MOVEMENTS,
  HYPE_TRAIN_WIDGET_PRESETS,
} from "./components/overlay/widgets/hype-train/hype-train-widget-config";
import {
  CREDITS_DEFAULT_HERO_THRESHOLDS,
  CREDITS_DEFAULT_SECTIONS,
  CREDITS_HERO_CATEGORIES,
  CREDITS_SECTION_IDS,
  CREDITS_SOCIAL_PLATFORMS,
  CREDITS_SOCIALS_LAYOUTS,
  CREDITS_WIDGET_LIMITS,
  CREDITS_WIDGET_PRESETS,
} from "./components/overlay/widgets/credits/credits-widget-config";
import {
  ANCHOR_X_VALUES,
  ANCHOR_Y_VALUES,
  DEFAULT_ANCHOR_X,
  DEFAULT_ANCHOR_Y,
} from "./components/overlay/lib/item-anchor";

const displayFieldLayoutSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().min(1).max(100),
  h: z.number().min(1).max(100),
  fontSize: z.number().min(8).max(80),
});

/** Persisted JSON on `clips_widget` rows (no per-field embed). */
export const clipsWidgetItemConfigSchema = z.object({
  sourceMode: z.enum(CLIP_SOURCE_MODES),
  folderIds: z.array(z.string()),
  gameIds: z.array(z.string()),
  creatorIds: z.array(z.string()),
  timeWindow: z.union([z.enum(TIME_WINDOW_PRESETS), z.literal("custom")]),
  customDateRange: z
    .object({ start: z.string(), end: z.string() })
    .optional(),
  sort: z.enum(CLIP_SORT_OPTIONS),
  minViewCount: z.number().int().min(0),
  isFeaturedOnly: z.boolean(),
  clipMuted: z.boolean().default(false),
  clipVolume: z.number().min(0).max(1).default(1),
  clipTransition: z.enum(["cut", "crossfade"]).default("cut"),
  clipTransitionMs: z.number().int().min(200).max(3000).default(600),
});

/** Full composite for validation when reading API responses / preview (merged shape). */
export const clipsWidgetCompositeConfigSchema = clipsWidgetItemConfigSchema.extend({
  displayFields: z.object(
    Object.fromEntries(
      DISPLAY_FIELD_KEYS.map((field) => [field, z.boolean()])
    ) as Record<DisplayFieldKey, z.ZodBoolean>
  ),
  displayFieldLayouts: z.object(
    Object.fromEntries(
      DISPLAY_FIELD_KEYS.map((field) => [field, displayFieldLayoutSchema])
    ) as Record<DisplayFieldKey, typeof displayFieldLayoutSchema>
  ),
  displayFieldLocks: z.object(
    Object.fromEntries(
      DISPLAY_FIELD_KEYS.map((field) => [field, z.boolean()])
    ) as Record<DisplayFieldKey, z.ZodBoolean>
  ),
  displayFieldOrder: z
    .array(
      z.enum(
        DISPLAY_FIELD_KEYS as unknown as [DisplayFieldKey, ...DisplayFieldKey[]]
      )
    )
    .length(DISPLAY_FIELD_KEYS.length)
    .refine((arr) => new Set(arr).size === DISPLAY_FIELD_KEYS.length, {
      message: "displayFieldOrder must be a permutation",
    }),
});

export const clipDisplayFieldItemConfigSchema = z.object({
  parentClipItemId: z.string().min(1),
  fieldKey: z.enum(
    DISPLAY_FIELD_KEYS as unknown as [DisplayFieldKey, ...DisplayFieldKey[]]
  ),
  stackOrder: z.number().int().min(0).max(99),
  layout: displayFieldLayoutSchema,
  isLayoutLocked: z.boolean(),
});

const hexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Expected #rgb or #rrggbb");

const googleFontFamilySchema = z
  .string()
  .min(1)
  .max(200)
  .refine((s) => isValidGoogleFontFamilyName(s), {
    message: "Invalid font family",
  });

const overlayTextStyleSchema = z.object({
  fontSize: z.number().min(8).max(200),
  color: hexColorSchema,
  align: z.enum(["left", "center", "right"]),
  fontWeight: z.union([
    z.literal(400),
    z.literal(500),
    z.literal(600),
    z.literal(700),
  ]),
  fontFamily: z.preprocess(
    (val) =>
      typeof val === "string" && isValidGoogleFontFamilyName(val)
        ? val.trim()
        : DEFAULT_GOOGLE_FONT_FAMILY,
    googleFontFamilySchema
  ),
});

/** Persisted JSON on `text_widget` rows. */
export const textWidgetItemConfigSchema = overlayTextStyleSchema.extend({
  text: z.string().min(0).max(5000),
});

const timerWidgetItemConfigSchemaInner = overlayTextStyleSchema.extend({
  finishedText: z.string().min(0).max(200),
  countdownMode: z.enum(["duration", "absolute"]),
  durationSeconds: z.number().int().min(10).max(604800),
  targetAtIso: z.string().min(1),
}).superRefine((data, ctx) => {
  if (data.countdownMode === "absolute" && Number.isNaN(Date.parse(data.targetAtIso))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid date/time",
      path: ["targetAtIso"],
    });
  }
});

/** Persisted JSON on `timer_widget` rows. */
export const timerWidgetItemConfigSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") return raw;
  const o = { ...(raw as Record<string, unknown>) };
  if (o.countdownMode !== "duration" && o.countdownMode !== "absolute") {
    if (
      typeof o.targetAtIso === "string" &&
      o.targetAtIso.length > 0 &&
      !Number.isNaN(Date.parse(o.targetAtIso))
    ) {
      o.countdownMode = "absolute";
    } else {
      o.countdownMode = "duration";
    }
  }
  if (
    typeof o.durationSeconds !== "number" ||
    !Number.isFinite(o.durationSeconds)
  ) {
    o.durationSeconds = 300;
  }
  if (typeof o.targetAtIso !== "string" || o.targetAtIso.length === 0) {
    o.targetAtIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }
  return o;
}, timerWidgetItemConfigSchemaInner);

/** Persisted JSON on `clock_widget` rows. */
export const clockWidgetItemConfigSchema = overlayTextStyleSchema.extend({
  timeZone: z.string().max(100).default(""),
  showDate: z.boolean().default(true),
  showTime: z.boolean().default(true),
  dateStyle: z.enum(["short", "medium", "long"]).default("medium"),
  timeStyle: z.enum(["short", "medium", "long"]).default("short"),
  hour12: z.boolean().default(false),
  showSeconds: z.boolean().default(true),
  layout: z.enum(["inline", "stacked"]).default("inline"),
});

export const irlFieldWidgetConfigSchema = overlayTextStyleSchema.extend({
  unit: z.enum(["kmh", "mph"]).default("kmh"),
  mockData: z.boolean().default(false),
});

export const customWidgetItemConfigSchema = z.object({
  widget_id: z.string().default(""),
  instance_id: z.string().default(""),
  // Author-defined settings, so the shape is only known to the widget itself.
  // Values are rendered as text or fed to the widget's own script -- never
  // executed here -- and the schema that produced them lives on the widget row.
  field_values: z.record(z.string(), z.unknown()).default({}),
});

const alertMediaKindSchema = z.enum(["", "image", "video"]).default("");

const alertVariantConfigSchema = z.object({
  enabled: z.boolean().default(true),
  mediaUrl: z.string().max(2000).default(""),
  mediaKind: alertMediaKindSchema,
  soundUrl: z.string().max(2000).default(""),
  volume: z.number().min(0).max(1).default(0.8),
  titleTemplate: z.string().max(200).default(""),
  messageTemplate: z.string().max(200).default(""),
  durationSeconds: z.number().min(0).max(60).default(6),
  durationMode: z.enum(["fixed", "media"]).default("fixed"),
  minAmount: z.number().int().min(0).max(1_000_000).default(0),
  layout: z.enum(["stacked", "row", "overlay"]).default("stacked"),
  animationIn: z
    .enum(["fade", "slide_up", "slide_down", "zoom", "bounce"])
    .default("zoom"),
  animationOut: z.enum(["fade", "slide_down", "zoom"]).default("fade"),
  fontFamily: z.preprocess(
    (val) =>
      typeof val === "string" && isValidGoogleFontFamilyName(val)
        ? val.trim()
        : DEFAULT_GOOGLE_FONT_FAMILY,
    googleFontFamilySchema
  ),
  fontSize: z.number().min(8).max(200).default(32),
  fontWeight: z
    .union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)])
    .default(700),
  align: z.enum(["left", "center", "right"]).default("center"),
  titleColor: hexColorSchema.default("#ffffff"),
  messageColor: hexColorSchema.default("#d4d4d8"),
  accentColor: hexColorSchema.default("#9e7aff"),
  textShadow: z.boolean().default(true),
});

/**
 * Persisted JSON on `alert_widget` rows.
 *
 * Built from ALERT_EVENT_TYPES rather than a hand-written list: a z.object
 * strips keys it does not declare, so every event missing here would be
 * silently dropped on save and come back on its default at the next load.
 * Each variant is optional so rows written before an event existed still
 * validate -- normalizeAlertWidgetConfig fills the gaps on read.
 */
export const alertWidgetItemConfigSchema = z.object({
  gapSeconds: z.number().min(0).max(30).default(1),
  masterVolume: z.number().min(0).max(1).default(0.8),
  variants: z.object(
    Object.fromEntries(
      ALERT_EVENT_TYPES.map((event) => [event, alertVariantConfigSchema.optional()])
    ) as Record<AlertEventType, z.ZodOptional<typeof alertVariantConfigSchema>>
  ),
});

/**
 * Persisted JSON on `chat_widget` rows. Every key is declared, nested maps
 * included: a z.object strips what it doesn't know, so a missing key would be
 * dropped on save. Defaults match createDefaultChatWidgetConfig so rows
 * written before a field existed still validate.
 */
export const chatWidgetItemConfigSchema = z.object({
  preset: z.enum(CHAT_WIDGET_PRESETS).default("bubbles"),
  fontFamily: z.preprocess(
    (val) =>
      typeof val === "string" && isValidGoogleFontFamilyName(val)
        ? val.trim()
        : DEFAULT_GOOGLE_FONT_FAMILY,
    googleFontFamilySchema
  ),
  fontSize: z
    .number()
    .min(CHAT_WIDGET_LIMITS.fontSize.min)
    .max(CHAT_WIDGET_LIMITS.fontSize.max)
    .default(20),
  fontWeight: z
    .union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)])
    .default(500),
  textColor: hexColorSchema.default("#ffffff"),
  nameColorMode: z.enum(CHAT_WIDGET_NAME_COLOR_MODES).default("user"),
  nameColor: hexColorSchema.default("#9e7aff"),
  backgroundColor: hexColorSchema.default("#0b0b12"),
  backgroundOpacity: z.number().min(0).max(1).default(0.7),
  radius: z
    .number()
    .min(CHAT_WIDGET_LIMITS.radius.min)
    .max(CHAT_WIDGET_LIMITS.radius.max)
    .default(12),
  gap: z.number().min(CHAT_WIDGET_LIMITS.gap.min).max(CHAT_WIDGET_LIMITS.gap.max).default(8),
  padding: z
    .number()
    .min(CHAT_WIDGET_LIMITS.padding.min)
    .max(CHAT_WIDGET_LIMITS.padding.max)
    .default(12),
  textShadow: z.boolean().default(true),
  layout: z.enum(CHAT_WIDGET_LAYOUTS).default("vertical"),
  direction: z.enum(CHAT_WIDGET_DIRECTIONS).default("bottom_up"),
  animationIn: z.enum(CHAT_WIDGET_ANIMATIONS_IN).default("slide_up"),
  animationOut: z.enum(CHAT_WIDGET_ANIMATIONS_OUT).default("fade"),
  animateMove: z.boolean().default(true),
  maxMessages: z
    .number()
    .int()
    .min(CHAT_WIDGET_LIMITS.maxMessages.min)
    .max(CHAT_WIDGET_LIMITS.maxMessages.max)
    .default(20),
  fadeAfterSeconds: z
    .number()
    .int()
    .min(CHAT_WIDGET_LIMITS.fadeAfterSeconds.min)
    .max(CHAT_WIDGET_LIMITS.fadeAfterSeconds.max)
    .default(0),
  showBadges: z.boolean().default(true),
  showAvatars: z.boolean().default(false),
  showGifs: z.boolean().default(true),
  notices: z
    .object({
      sub: z.boolean().default(true),
      resub: z.boolean().default(true),
      gift: z.boolean().default(true),
      raid: z.boolean().default(true),
      announcement: z.boolean().default(true),
      other: z.boolean().default(false),
    })
    .default({
      sub: true,
      resub: true,
      gift: true,
      raid: true,
      announcement: true,
      other: false,
    }),
  hiddenUsers: z
    .array(
      z
        .string()
        .max(CHAT_WIDGET_LIMITS.hiddenUserLength)
        .regex(/^[a-z0-9_]+$/, "Expected a lowercase Twitch login")
    )
    .max(CHAT_WIDGET_LIMITS.hiddenUsers)
    .default([...DEFAULT_CHAT_WIDGET_HIDDEN_USERS]),
  hideCommands: z.boolean().default(true),
  emoteProviders: z
    .object({
      "7tv": z.boolean().default(true),
      bttv: z.boolean().default(true),
      ffz: z.boolean().default(true),
    })
    .default({ "7tv": true, bttv: true, ffz: true }),
});

/**
 * Persisted JSON on the goal widget rows (follower, sub and Bits). Every
 * key has a default matching createDefaultGoalWidgetConfig, for the same
 * reason as the chat schema above.
 */
export const goalWidgetItemConfigSchema = z.object({
  preset: z.enum(GOAL_WIDGET_PRESETS).default("text"),
  title: z.string().max(GOAL_WIDGET_LIMITS.title).default(""),
  showTitle: z.boolean().default(true),
  showNumbers: z.boolean().default(true),
  showPercent: z.boolean().default(false),
  showRemaining: z.boolean().default(false),
  showIcon: z.boolean().default(false),
  iconUrl: z.string().max(GOAL_WIDGET_LIMITS.iconUrl).default(""),
  onEnd: z.enum(GOAL_WIDGET_ON_END).default("keep"),
  fontFamily: z.preprocess(
    (val) =>
      typeof val === "string" && isValidGoogleFontFamilyName(val)
        ? val.trim()
        : DEFAULT_GOOGLE_FONT_FAMILY,
    googleFontFamilySchema
  ),
  fontSize: z
    .number()
    .min(GOAL_WIDGET_LIMITS.fontSize.min)
    .max(GOAL_WIDGET_LIMITS.fontSize.max)
    .default(22),
  fontWeight: z
    .union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)])
    .default(600),
  textColor: hexColorSchema.default("#ffffff"),
  textShadow: z.boolean().default(true),
  fillMode: z.enum(GOAL_WIDGET_FILL_MODES).default("solid"),
  fillColor: hexColorSchema.default("#9e7aff"),
  fillColor2: hexColorSchema.default("#fe8bbb"),
  trackColor: hexColorSchema.default("#0b0b12"),
  trackOpacity: z.number().min(0).max(1).default(0.7),
  radius: z.number().min(GOAL_WIDGET_LIMITS.radius.min).max(GOAL_WIDGET_LIMITS.radius.max).default(24),
  blockCount: z
    .number()
    .int()
    .min(GOAL_WIDGET_LIMITS.blockCount.min)
    .max(GOAL_WIDGET_LIMITS.blockCount.max)
    .default(0),
  pulseOnProgress: z.boolean().default(true),
  celebration: z.enum(GOAL_WIDGET_CELEBRATIONS).default("shine"),
  animationIn: z.enum(GOAL_WIDGET_ANIMATIONS_IN).default("fade"),
  animationOut: z.enum(GOAL_WIDGET_ANIMATIONS_OUT).default("fade"),
  arcadeRestoreFont: z.string().max(200).default(""),
  arcadeRestoreRadius: z.number().min(-1).max(GOAL_WIDGET_LIMITS.radius.max).default(-1),
});

/**
 * Persisted JSON on poll widget rows. Every key has a default matching
 * createDefaultPollWidgetConfig, for the same reason as the chat schema above.
 */
export const pollWidgetItemConfigSchema = z.object({
  preset: z.enum(POLL_WIDGET_PRESETS).default("bars"),
  title: z.string().max(POLL_WIDGET_LIMITS.title).default(""),
  showTitle: z.boolean().default(true),
  showVotes: z.boolean().default(false),
  showPercent: z.boolean().default(true),
  showTimer: z.boolean().default(true),
  colorMode: z.enum(POLL_WIDGET_COLOR_MODES).default("palette"),
  choiceColors: z.array(hexColorSchema).length(POLL_DEFAULT_CHOICE_COLORS.length).default([...POLL_DEFAULT_CHOICE_COLORS]),
  leaderColor: hexColorSchema.default("#9e7aff"),
  otherColor: hexColorSchema.default("#6b6b80"),
  fontFamily: z.preprocess(
    (val) =>
      typeof val === "string" && isValidGoogleFontFamilyName(val)
        ? val.trim()
        : DEFAULT_GOOGLE_FONT_FAMILY,
    googleFontFamilySchema
  ),
  fontSize: z
    .number()
    .min(POLL_WIDGET_LIMITS.fontSize.min)
    .max(POLL_WIDGET_LIMITS.fontSize.max)
    .default(20),
  fontWeight: z
    .union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)])
    .default(600),
  textColor: hexColorSchema.default("#ffffff"),
  textShadow: z.boolean().default(true),
  trackColor: hexColorSchema.default("#0b0b12"),
  trackOpacity: z.number().min(0).max(1).default(0.7),
  radius: z.number().min(POLL_WIDGET_LIMITS.radius.min).max(POLL_WIDGET_LIMITS.radius.max).default(12),
  pulseOnVote: z.boolean().default(true),
  celebration: z.enum(POLL_WIDGET_CELEBRATIONS).default("glow"),
  hideAfterSeconds: z
    .number()
    .int()
    .min(POLL_WIDGET_LIMITS.hideAfterSeconds.min)
    .max(POLL_WIDGET_LIMITS.hideAfterSeconds.max)
    .default(10),
  animationIn: z.enum(POLL_WIDGET_ANIMATIONS_IN).default("fade"),
  animationOut: z.enum(POLL_WIDGET_ANIMATIONS_OUT).default("fade"),
});

/**
 * Persisted JSON on ad widget rows. Every key has a default matching
 * createDefaultAdWidgetConfig, for the same reason as the chat schema above.
 */
export const adWidgetItemConfigSchema = z.object({
  preset: z.enum(AD_WIDGET_PRESETS).default("badge"),
  warnMinutes: z.number().min(AD_WIDGET_LIMITS.warnMinutes.min).max(AD_WIDGET_LIMITS.warnMinutes.max).default(2),
  showWarning: z.boolean().default(true),
  showRunning: z.boolean().default(true),
  showBackMessage: z.boolean().default(true),
  warningText: z.string().max(AD_WIDGET_LIMITS.text).default("Ads in {time}"),
  runningText: z.string().max(AD_WIDGET_LIMITS.text).default("Back in {time}"),
  backText: z.string().max(AD_WIDGET_LIMITS.text).default("Thanks for sticking around"),
  cardMessage: z.string().max(AD_WIDGET_LIMITS.text).default("Stretch, grab a drink. Back soon."),
  showIcon: z.boolean().default(true),
  accentColor: hexColorSchema.default("#fbbf24"),
  trackColor: hexColorSchema.default("#0b0b12"),
  trackOpacity: z.number().min(0).max(1).default(0.85),
  textColor: hexColorSchema.default("#ffffff"),
  radius: z.number().min(AD_WIDGET_LIMITS.radius.min).max(AD_WIDGET_LIMITS.radius.max).default(16),
  fontFamily: z.preprocess(
    (val) =>
      typeof val === "string" && isValidGoogleFontFamilyName(val)
        ? val.trim()
        : DEFAULT_GOOGLE_FONT_FAMILY,
    googleFontFamilySchema
  ),
  fontSize: z.number().min(AD_WIDGET_LIMITS.fontSize.min).max(AD_WIDGET_LIMITS.fontSize.max).default(22),
  fontWeight: z
    .union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)])
    .default(700),
  textShadow: z.boolean().default(true),
  animationIn: z.enum(AD_WIDGET_ANIMATIONS_IN).default("slide_up"),
  animationOut: z.enum(AD_WIDGET_ANIMATIONS_OUT).default("fade"),
});

/** Persisted JSON on `uptime_widget` rows. Defaults mirror createDefaultUptimeWidgetConfig. */
export const uptimeWidgetItemConfigSchema = z.object({
  label: z.string().max(UPTIME_WIDGET_LIMITS.label).default("Live for"),
  layout: z.enum(UPTIME_WIDGET_LAYOUTS).default("inline"),
  showSeconds: z.boolean().default(true),
  showDot: z.boolean().default(true),
  dotColor: hexColorSchema.default("#ff4d4d"),
  offlineText: z.string().max(UPTIME_WIDGET_LIMITS.offlineText).default("Offline"),
  hideWhenOffline: z.boolean().default(true),
  fontFamily: z.preprocess(
    (val) =>
      typeof val === "string" && isValidGoogleFontFamilyName(val)
        ? val.trim()
        : DEFAULT_GOOGLE_FONT_FAMILY,
    googleFontFamilySchema
  ),
  fontSize: z.number().min(UPTIME_WIDGET_LIMITS.fontSize.min).max(UPTIME_WIDGET_LIMITS.fontSize.max).default(28),
  fontWeight: z
    .union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)])
    .default(600),
  color: hexColorSchema.default("#ffffff"),
  align: z.enum(["left", "center", "right"]).default("center"),
  textShadow: z.boolean().default(true),
});

/** Persisted JSON on `label_widget` rows. Defaults mirror createDefaultLabelWidgetConfig. */
export const labelWidgetItemConfigSchema = z.object({
  labelId: z.enum(LABEL_WIDGET_IDS as [string, ...string[]]).default("latest_follower"),
  // Optional: the default depends on the label, normalizeLabelWidgetConfig fills it.
  period: z.enum(LABEL_PERIODS).optional(),
  template: z.string().max(LABEL_WIDGET_LIMITS.template).default(""),
  prefix: z.string().max(LABEL_WIDGET_LIMITS.prefix).default("Latest follower"),
  layout: z.enum(LABEL_WIDGET_LAYOUTS).default("inline"),
  emptyText: z.string().max(LABEL_WIDGET_LIMITS.emptyText).default(""),
  count: z.number().int().min(LABEL_WIDGET_LIMITS.count.min).max(LABEL_WIDGET_LIMITS.count.max).default(5),
  direction: z.enum(LABEL_WIDGET_DIRECTIONS).default("vertical"),
  separator: z.string().max(LABEL_WIDGET_LIMITS.separator).default("•"),
  marquee: z.boolean().default(false),
  marqueeSpeed: z
    .number()
    .min(LABEL_WIDGET_LIMITS.marqueeSpeed.min)
    .max(LABEL_WIDGET_LIMITS.marqueeSpeed.max)
    .default(60),
  animation: z.enum(LABEL_WIDGET_ANIMATIONS).default("pop"),
  animationDuration: z
    .number()
    .min(LABEL_WIDGET_LIMITS.animationDuration.min)
    .max(LABEL_WIDGET_LIMITS.animationDuration.max)
    .default(500),
  fontFamily: z.preprocess(
    (val) =>
      typeof val === "string" && isValidGoogleFontFamilyName(val)
        ? val.trim()
        : DEFAULT_GOOGLE_FONT_FAMILY,
    googleFontFamilySchema
  ),
  fontSize: z.number().min(LABEL_WIDGET_LIMITS.fontSize.min).max(LABEL_WIDGET_LIMITS.fontSize.max).default(28),
  fontWeight: z
    .union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)])
    .default(600),
  color: hexColorSchema.default("#ffffff"),
  prefixColor: hexColorSchema.default("#c4b5fd"),
  align: z.enum(["left", "center", "right"]).default("center"),
  textShadow: z.boolean().default(true),
});

const emoteBurstSchema = (enabled: boolean, animation: (typeof EMOTE_ANIMATIONS)[number], count: number) =>
  z
    .object({
      enabled: z.boolean().default(enabled),
      animation: z.enum(EMOTE_ANIMATIONS).default(animation),
      count: z
        .number()
        .int()
        .min(EMOTE_WIDGET_LIMITS.burstCount.min)
        .max(EMOTE_WIDGET_LIMITS.burstCount.max)
        .default(count),
      emotes: z
        .array(
          z.union([
            // Older rows: code only.
            z.string().min(1).max(EMOTE_WIDGET_LIMITS.emoteCodeLength),
            z.object({
              code: z.string().min(1).max(EMOTE_WIDGET_LIMITS.emoteCodeLength),
              url: z.string().max(EMOTE_WIDGET_LIMITS.emoteUrlLength),
            }),
          ])
        )
        .max(EMOTE_WIDGET_LIMITS.emoteCodes)
        .default([]),
    })
    .default({ enabled, animation, count, emotes: [] });

/**
 * Persisted JSON on `emote_widget` rows. Every key is declared, nested maps
 * included, or it is dropped on save. Defaults mirror createDefaultEmoteWidgetConfig.
 */
export const emoteWidgetItemConfigSchema = z.object({
  chatEnabled: z.boolean().default(true),
  animation: z.enum(EMOTE_ANIMATIONS).default("float_up"),
  emoteSize: z
    .number()
    .int()
    .min(EMOTE_WIDGET_LIMITS.emoteSize.min)
    .max(EMOTE_WIDGET_LIMITS.emoteSize.max)
    .default(56),
  duration: z
    .number()
    .int()
    .min(EMOTE_WIDGET_LIMITS.duration.min)
    .max(EMOTE_WIDGET_LIMITS.duration.max)
    .default(5000),
  maxOnScreen: z
    .number()
    .int()
    .min(EMOTE_WIDGET_LIMITS.maxOnScreen.min)
    .max(EMOTE_WIDGET_LIMITS.maxOnScreen.max)
    .default(150),
  maxPerMessage: z
    .number()
    .int()
    .min(EMOTE_WIDGET_LIMITS.maxPerMessage.min)
    .max(EMOTE_WIDGET_LIMITS.maxPerMessage.max)
    .default(5),
  emoteProviders: z
    .object({
      "7tv": z.boolean().default(true),
      bttv: z.boolean().default(true),
      ffz: z.boolean().default(true),
    })
    .default({ "7tv": true, bttv: true, ffz: true }),
  hiddenUsers: z
    .array(
      z
        .string()
        .max(EMOTE_WIDGET_LIMITS.hiddenUserLength)
        .regex(/^[a-z0-9_]+$/, "Expected a lowercase Twitch login")
    )
    .max(EMOTE_WIDGET_LIMITS.hiddenUsers)
    .default([...DEFAULT_EMOTE_WIDGET_HIDDEN_USERS]),
  hideCommands: z.boolean().default(true),
  blockedEmotes: z
    .array(z.string().min(1).max(EMOTE_WIDGET_LIMITS.emoteCodeLength))
    .max(EMOTE_WIDGET_LIMITS.emoteCodes)
    .default([]),
  userCooldown: z
    .number()
    .int()
    .min(EMOTE_WIDGET_LIMITS.userCooldown.min)
    .max(EMOTE_WIDGET_LIMITS.userCooldown.max)
    .default(0),
  events: z
    .object(
      Object.fromEntries(
        EMOTE_WIDGET_EVENTS.map((e) => {
          const d = DEFAULT_EMOTE_WIDGET_BURSTS[e];
          return [e, emoteBurstSchema(d.enabled, d.animation, d.count)];
        }),
      ) as Record<EmoteWidgetEvent, ReturnType<typeof emoteBurstSchema>>,
    )
    .default(() => createDefaultEmoteWidgetConfig().events),
});

/** Persisted JSON on `combo_widget` rows. Defaults mirror createDefaultComboWidgetConfig. */
export const comboWidgetItemConfigSchema = z.object({
  mode: z.enum(COMBO_WIDGET_MODES).default("time_window"),
  windowSeconds: z
    .number()
    .int()
    .min(COMBO_WIDGET_LIMITS.windowSeconds.min)
    .max(COMBO_WIDGET_LIMITS.windowSeconds.max)
    .default(8),
  threshold: z
    .number()
    .int()
    .min(COMBO_WIDGET_LIMITS.threshold.min)
    .max(COMBO_WIDGET_LIMITS.threshold.max)
    .default(3),
  countMode: z.enum(COMBO_WIDGET_COUNT_MODES).default("unique"),
  maxCombos: z
    .number()
    .int()
    .min(COMBO_WIDGET_LIMITS.maxCombos.min)
    .max(COMBO_WIDGET_LIMITS.maxCombos.max)
    .default(1),
  lingerSeconds: z
    .number()
    .int()
    .min(COMBO_WIDGET_LIMITS.lingerSeconds.min)
    .max(COMBO_WIDGET_LIMITS.lingerSeconds.max)
    .default(3),
  preset: z.enum(COMBO_WIDGET_PRESETS).default("punch"),
  layout: z.enum(COMBO_WIDGET_LAYOUTS).default("vertical"),
  text: z.string().max(COMBO_WIDGET_LIMITS.text).default("x{count} COMBO"),
  emoteSize: z
    .number()
    .int()
    .min(COMBO_WIDGET_LIMITS.emoteSize.min)
    .max(COMBO_WIDGET_LIMITS.emoteSize.max)
    .default(72),
  fontFamily: z.preprocess(
    (val) =>
      typeof val === "string" && isValidGoogleFontFamilyName(val)
        ? val.trim()
        : DEFAULT_GOOGLE_FONT_FAMILY,
    googleFontFamilySchema
  ),
  fontSize: z
    .number()
    .int()
    .min(COMBO_WIDGET_LIMITS.fontSize.min)
    .max(COMBO_WIDGET_LIMITS.fontSize.max)
    .default(44),
  fontWeight: z
    .union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)])
    .default(700),
  color: hexColorSchema.default("#ffffff"),
  accentColor: hexColorSchema.default("#9e7aff"),
  milestones: z
    .array(
      z.number().int().min(COMBO_WIDGET_LIMITS.milestone.min).max(COMBO_WIDGET_LIMITS.milestone.max)
    )
    .max(COMBO_WIDGET_LIMITS.milestones)
    .default([10, 25, 50]),
  textShadow: z.boolean().default(true),
  emoteProviders: z
    .object({
      "7tv": z.boolean().default(true),
      bttv: z.boolean().default(true),
      ffz: z.boolean().default(true),
    })
    .default({ "7tv": true, bttv: true, ffz: true }),
  hiddenUsers: z
    .array(
      z
        .string()
        .max(EMOTE_WIDGET_LIMITS.hiddenUserLength)
        .regex(/^[a-z0-9_]+$/, "Expected a lowercase Twitch login")
    )
    .max(EMOTE_WIDGET_LIMITS.hiddenUsers)
    .default([...DEFAULT_EMOTE_WIDGET_HIDDEN_USERS]),
  hideCommands: z.boolean().default(true),
  blockedEmotes: z
    .array(z.string().min(1).max(EMOTE_WIDGET_LIMITS.emoteCodeLength))
    .max(EMOTE_WIDGET_LIMITS.emoteCodes)
    .default([]),
});

/** Persisted JSON on `hype_train_widget` rows. Defaults mirror createDefaultHypeTrainWidgetConfig. */
export const hypeTrainWidgetItemConfigSchema = z.object({
  preset: z.enum(HYPE_TRAIN_WIDGET_PRESETS).default("steam"),
  movement: z.enum(HYPE_TRAIN_WIDGET_MOVEMENTS).default("bounce"),
  direction: z.enum(HYPE_TRAIN_WIDGET_DIRECTIONS).default("ltr"),
  trainSize: z
    .number()
    .int()
    .min(HYPE_TRAIN_WIDGET_LIMITS.trainSize.min)
    .max(HYPE_TRAIN_WIDGET_LIMITS.trainSize.max)
    .default(150),
  speed: z
    .number()
    .int()
    .min(HYPE_TRAIN_WIDGET_LIMITS.speed.min)
    .max(HYPE_TRAIN_WIDGET_LIMITS.speed.max)
    .default(420),
  speedPerLevel: z
    .number()
    .int()
    .min(HYPE_TRAIN_WIDGET_LIMITS.speedPerLevel.min)
    .max(HYPE_TRAIN_WIDGET_LIMITS.speedPerLevel.max)
    .default(15),
  maxWagons: z
    .number()
    .int()
    .min(HYPE_TRAIN_WIDGET_LIMITS.maxWagons.min)
    .max(HYPE_TRAIN_WIDGET_LIMITS.maxWagons.max)
    .default(20),
  joinEffect: z.enum(HYPE_TRAIN_WIDGET_JOIN_EFFECTS).default("drop"),
  showAvatars: z.boolean().default(true),
  showAmounts: z.boolean().default(true),
  showLevel: z.boolean().default(true),
  fontFamily: z.preprocess(
    (val) =>
      typeof val === "string" && isValidGoogleFontFamilyName(val)
        ? val.trim()
        : DEFAULT_GOOGLE_FONT_FAMILY,
    googleFontFamilySchema
  ),
  color: hexColorSchema.default("#ffffff"),
  trainColor: hexColorSchema.default("#7c5cff"),
  accentColor: hexColorSchema.default("#ffd166"),
});

/** Persisted JSON on `credits_widget` rows. Defaults mirror createDefaultCreditsWidgetConfig. */
export const creditsWidgetItemConfigSchema = z.object({
  preset: z.enum(CREDITS_WIDGET_PRESETS).default("classic"),
  sections: z
    .array(
      z.object({
        id: z.enum(CREDITS_SECTION_IDS),
        enabled: z.boolean(),
        label: z.string().max(CREDITS_WIDGET_LIMITS.sectionLabel),
      }),
    )
    .default(() => CREDITS_DEFAULT_SECTIONS.map((s) => ({ ...s }))),
  titleText: z.string().max(CREDITS_WIDGET_LIMITS.titleText).default("Thanks for watching"),
  outroText: z.string().max(CREDITS_WIDGET_LIMITS.outroText).default("See you next stream"),
  thanksText: z.string().max(CREDITS_WIDGET_LIMITS.thanksText).default(""),
  showCounts: z.boolean().default(true),
  showValues: z.boolean().default(true),
  showAvatars: z.boolean().default(false),
  maxNamesPerSection: z
    .number()
    .int()
    .min(CREDITS_WIDGET_LIMITS.maxNamesPerSection.min)
    .max(CREDITS_WIDGET_LIMITS.maxNamesPerSection.max)
    .default(30),
  moreText: z.string().max(CREDITS_WIDGET_LIMITS.moreText).default("and {n} more"),
  secondsPerSection: z
    .number()
    .min(CREDITS_WIDGET_LIMITS.secondsPerSection.min)
    .max(CREDITS_WIDGET_LIMITS.secondsPerSection.max)
    .default(6),
  scrollSpeed: z.number().min(CREDITS_WIDGET_LIMITS.scrollSpeed.min).max(CREDITS_WIDGET_LIMITS.scrollSpeed.max).default(60),
  startDelaySeconds: z
    .number()
    .min(CREDITS_WIDGET_LIMITS.startDelaySeconds.min)
    .max(CREDITS_WIDGET_LIMITS.startDelaySeconds.max)
    .default(1),
  loop: z.boolean().default(false),
  loopDelaySeconds: z
    .number()
    .min(CREDITS_WIDGET_LIMITS.loopDelaySeconds.min)
    .max(CREDITS_WIDGET_LIMITS.loopDelaySeconds.max)
    .default(3),
  heroCategories: z.array(z.enum(CREDITS_HERO_CATEGORIES)).default(["gifters", "cheerers", "raids"]),
  heroThresholds: z
    .object(
      Object.fromEntries(
        CREDITS_HERO_CATEGORIES.map((id) => [
          id,
          z.number().int().min(CREDITS_WIDGET_LIMITS.heroThreshold.min).max(CREDITS_WIDGET_LIMITS.heroThreshold.max).default(CREDITS_DEFAULT_HERO_THRESHOLDS[id]),
        ]),
      ) as Record<(typeof CREDITS_HERO_CATEGORIES)[number], z.ZodDefault<z.ZodNumber>>,
    )
    .default(() => ({ ...CREDITS_DEFAULT_HERO_THRESHOLDS })),
  heroTopCount: z.number().int().min(CREDITS_WIDGET_LIMITS.heroTopCount.min).max(CREDITS_WIDGET_LIMITS.heroTopCount.max).default(3),
  heroGroupSize: z.number().int().min(CREDITS_WIDGET_LIMITS.heroGroupSize.min).max(CREDITS_WIDGET_LIMITS.heroGroupSize.max).default(1),
  heroHoldSeconds: z.number().min(CREDITS_WIDGET_LIMITS.heroHoldSeconds.min).max(CREDITS_WIDGET_LIMITS.heroHoldSeconds.max).default(3),
  heroFadeMs: z.number().int().min(CREDITS_WIDGET_LIMITS.heroFadeMs.min).max(CREDITS_WIDGET_LIMITS.heroFadeMs.max).default(700),
  socials: z
    .array(z.object({ platform: z.enum(CREDITS_SOCIAL_PLATFORMS), handle: z.string().max(CREDITS_WIDGET_LIMITS.socialHandle) }))
    .max(CREDITS_WIDGET_LIMITS.socials)
    .default([]),
  socialsBrandColors: z.boolean().default(true),
  socialsLayout: z.enum(CREDITS_SOCIALS_LAYOUTS).default("list"),
  fontFamily: z.preprocess(
    (val) =>
      typeof val === "string" && isValidGoogleFontFamilyName(val)
        ? val.trim()
        : DEFAULT_GOOGLE_FONT_FAMILY,
    googleFontFamilySchema
  ),
  fontSize: z.number().min(CREDITS_WIDGET_LIMITS.fontSize.min).max(CREDITS_WIDGET_LIMITS.fontSize.max).default(28),
  fontWeight: z
    .union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)])
    .default(600),
  textColor: hexColorSchema.default("#ffffff"),
  accentColor: hexColorSchema.default("#9e7aff"),
  backgroundColor: hexColorSchema.default("#0b0b12"),
  backgroundOpacity: z.number().min(0).max(1).default(0),
  textShadow: z.boolean().default(true),
  arcadeRestoreFont: z.string().default(""),
});

export const overlayItemConfigSchema = z.union([
  clipsWidgetItemConfigSchema,
  clipDisplayFieldItemConfigSchema,
  textWidgetItemConfigSchema,
  timerWidgetItemConfigSchema,
  clockWidgetItemConfigSchema,
  irlFieldWidgetConfigSchema,
  customWidgetItemConfigSchema,
  alertWidgetItemConfigSchema,
  chatWidgetItemConfigSchema,
  goalWidgetItemConfigSchema,
  pollWidgetItemConfigSchema,
  adWidgetItemConfigSchema,
  uptimeWidgetItemConfigSchema,
  creditsWidgetItemConfigSchema,
  labelWidgetItemConfigSchema,
  emoteWidgetItemConfigSchema,
  comboWidgetItemConfigSchema,
  hypeTrainWidgetItemConfigSchema,
]);

/**
 * The geometry every item variant shares. `x`/`y` are offsets from the item's
 * anchor, so they may go negative for a centre anchor (left of / above the
 * centre); the editor keeps the resolved rect inside the scene.
 */
const overlayItemBoxFields = {
  x: z.number(),
  y: z.number(),
  anchor_x: z.enum(ANCHOR_X_VALUES).default(DEFAULT_ANCHOR_X),
  anchor_y: z.enum(ANCHOR_Y_VALUES).default(DEFAULT_ANCHOR_Y),
  w: z.number().min(50),
  h: z.number().min(50),
  design_w: z.number().min(1).max(20000),
  design_h: z.number().min(1).max(20000),
  crop_top: z.number().min(0).max(20000),
  crop_right: z.number().min(0).max(20000),
  crop_bottom: z.number().min(0).max(20000),
  crop_left: z.number().min(0).max(20000),
  // Payloads from before flipping existed carry neither; unflipped is what they meant.
  flip_h: z.boolean().default(false),
  flip_v: z.boolean().default(false),
};

export const overlayItemSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().uuid().optional(),
    scene_id: z.string().uuid(),
    type: z.literal("clips_widget"),
    ...overlayItemBoxFields,
    z_index: z.number().int(),
    rotation: z.number().min(-360).max(360),
    opacity: z.number().min(0).max(1),
    is_visible: z.boolean(),
    is_locked: z.boolean(),
    label: z.string().min(1).max(100),
    config: clipsWidgetItemConfigSchema,
  }),
  z.object({
    id: z.string().uuid().optional(),
    scene_id: z.string().uuid(),
    type: z.literal("clip_display_field"),
    ...overlayItemBoxFields,
    z_index: z.number().int(),
    rotation: z.number().min(-360).max(360),
    opacity: z.number().min(0).max(1),
    is_visible: z.boolean(),
    is_locked: z.boolean(),
    label: z.string().min(1).max(100),
    config: clipDisplayFieldItemConfigSchema,
  }),
  z.object({
    id: z.string().uuid().optional(),
    scene_id: z.string().uuid(),
    type: z.literal("text_widget"),
    ...overlayItemBoxFields,
    z_index: z.number().int(),
    rotation: z.number().min(-360).max(360),
    opacity: z.number().min(0).max(1),
    is_visible: z.boolean(),
    is_locked: z.boolean(),
    label: z.string().min(1).max(100),
    config: textWidgetItemConfigSchema,
  }),
  z.object({
    id: z.string().uuid().optional(),
    scene_id: z.string().uuid(),
    type: z.literal("timer_widget"),
    ...overlayItemBoxFields,
    z_index: z.number().int(),
    rotation: z.number().min(-360).max(360),
    opacity: z.number().min(0).max(1),
    is_visible: z.boolean(),
    is_locked: z.boolean(),
    label: z.string().min(1).max(100),
    config: timerWidgetItemConfigSchema,
  }),
  z.object({
    id: z.string().uuid().optional(),
    scene_id: z.string().uuid(),
    type: z.literal("clock_widget"),
    ...overlayItemBoxFields,
    z_index: z.number().int(),
    rotation: z.number().min(-360).max(360),
    opacity: z.number().min(0).max(1),
    is_visible: z.boolean(),
    is_locked: z.boolean(),
    label: z.string().min(1).max(100),
    config: clockWidgetItemConfigSchema,
  }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("irl_speed_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: irlFieldWidgetConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("irl_heading_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: irlFieldWidgetConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("irl_altitude_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: irlFieldWidgetConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("irl_latitude_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: irlFieldWidgetConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("irl_longitude_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: irlFieldWidgetConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("irl_accuracy_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: irlFieldWidgetConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("custom_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: customWidgetItemConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("alert_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: alertWidgetItemConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("chat_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: chatWidgetItemConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("follower_goal_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: goalWidgetItemConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("sub_goal_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: goalWidgetItemConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("bits_goal_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: goalWidgetItemConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("poll_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: pollWidgetItemConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("ad_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: adWidgetItemConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("uptime_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: uptimeWidgetItemConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("label_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: labelWidgetItemConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("emote_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: emoteWidgetItemConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("combo_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: comboWidgetItemConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("hype_train_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: hypeTrainWidgetItemConfigSchema }),
  z.object({ id: z.string().uuid().optional(), scene_id: z.string().uuid(), type: z.literal("credits_widget"), ...overlayItemBoxFields, z_index: z.number().int(), rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1), is_visible: z.boolean(), is_locked: z.boolean(), label: z.string().min(1).max(100), config: creditsWidgetItemConfigSchema }),
]);

export const createSceneSchema = z.object({
  name: z.string().min(1).max(100),
  width: z.number().int().min(100).max(7680).default(1920),
  height: z.number().int().min(100).max(4320).default(1080),
});

export const updateSceneSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  width: z.number().int().min(100).max(7680).optional(),
  height: z.number().int().min(100).max(4320).optional(),
  is_active: z.boolean().optional(),
  is_favourite: z.boolean().optional(),
});

/** Alias / API validation for merged clip widget config. */
export const clipsWidgetConfigSchema = clipsWidgetCompositeConfigSchema;
