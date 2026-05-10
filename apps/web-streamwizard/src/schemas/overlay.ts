import { z } from "zod";
import {
  DEFAULT_GOOGLE_FONT_FAMILY,
  isValidGoogleFontFamilyName,
} from "@/constants/google-fonts";
import {
  CLIP_SORT_OPTIONS,
  CLIP_SOURCE_MODES,
  DISPLAY_FIELD_KEYS,
  type DisplayFieldKey,
  TIME_WINDOW_PRESETS,
} from "@/types/overlays";

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
  folderIds: z.array(z.number()),
  gameIds: z.array(z.string()),
  creatorIds: z.array(z.string()),
  timeWindow: z.union([z.enum(TIME_WINDOW_PRESETS), z.literal("custom")]),
  customDateRange: z
    .object({ start: z.string(), end: z.string() })
    .optional(),
  sort: z.enum(CLIP_SORT_OPTIONS),
  maxClips: z.number().int().min(1).max(100),
  minViewCount: z.number().int().min(0),
  isFeaturedOnly: z.boolean(),
  refreshIntervalSeconds: z.number().int().min(10).max(3600),
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

export const overlayItemConfigSchema = z.union([
  clipsWidgetItemConfigSchema,
  clipDisplayFieldItemConfigSchema,
  textWidgetItemConfigSchema,
  timerWidgetItemConfigSchema,
  clockWidgetItemConfigSchema,
]);

export const overlayItemSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().uuid().optional(),
    scene_id: z.string().uuid(),
    type: z.literal("clips_widget"),
    x: z.number().min(0),
    y: z.number().min(0),
    w: z.number().min(50),
    h: z.number().min(50),
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
    x: z.number().min(0),
    y: z.number().min(0),
    w: z.number().min(50),
    h: z.number().min(50),
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
    x: z.number().min(0),
    y: z.number().min(0),
    w: z.number().min(50),
    h: z.number().min(50),
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
    x: z.number().min(0),
    y: z.number().min(0),
    w: z.number().min(50),
    h: z.number().min(50),
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
    x: z.number().min(0),
    y: z.number().min(0),
    w: z.number().min(50),
    h: z.number().min(50),
    z_index: z.number().int(),
    rotation: z.number().min(-360).max(360),
    opacity: z.number().min(0).max(1),
    is_visible: z.boolean(),
    is_locked: z.boolean(),
    label: z.string().min(1).max(100),
    config: clockWidgetItemConfigSchema,
  }),
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
});

/** Alias / API validation for merged clip widget config. */
export const clipsWidgetConfigSchema = clipsWidgetCompositeConfigSchema;
