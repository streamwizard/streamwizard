export type GoogleFontFamily = string;
export const DEFAULT_GOOGLE_FONT_FAMILY: GoogleFontFamily = "Inter";

export function isValidGoogleFontFamilyName(v: string): boolean {
  const t = v.trim();
  return t.length > 0 && t.length <= 200 && !/[<>]/.test(t);
}

export const IRL_FIELD_WIDGET_TYPES = [
  "irl_speed_widget",
  "irl_heading_widget",
  "irl_altitude_widget",
  "irl_latitude_widget",
  "irl_longitude_widget",
  "irl_accuracy_widget",
] as const;
export type IrlFieldWidgetType = (typeof IRL_FIELD_WIDGET_TYPES)[number];

export const OVERLAY_ITEM_TYPES = [
  "clips_widget",
  "clip_display_field",
  "text_widget",
  "timer_widget",
  "clock_widget",
  "custom_widget",
  ...IRL_FIELD_WIDGET_TYPES,
] as const;
export type OverlayItemType = (typeof OVERLAY_ITEM_TYPES)[number];

/** Root overlay items that can be added from the widget library. */
export const ROOT_OVERLAY_ITEM_TYPES = [
  "clips_widget",
  "text_widget",
  "timer_widget",
  "clock_widget",
  "custom_widget",
  ...IRL_FIELD_WIDGET_TYPES,
] as const;
export type RootOverlayItemType = (typeof ROOT_OVERLAY_ITEM_TYPES)[number];

export function isRootOverlayItemType(
  type: OverlayItemType
): type is RootOverlayItemType {
  return (ROOT_OVERLAY_ITEM_TYPES as readonly string[]).includes(type);
}

/** Overlay item types that exist as child rows (not in the widget sheet). */
export type ChildOverlayItemType = Exclude<OverlayItemType, RootOverlayItemType>;

export const CLIP_SOURCE_MODES = ["all", "folders", "game", "custom"] as const;
export type ClipSourceMode = (typeof CLIP_SOURCE_MODES)[number];

export const CLIP_SORT_OPTIONS = ["newest", "oldest", "most_viewed", "least_viewed", "random"] as const;
export type ClipSortOption = (typeof CLIP_SORT_OPTIONS)[number];

export const CLIP_TRANSITION_MODES = ["cut", "crossfade"] as const;
export type ClipTransitionMode = (typeof CLIP_TRANSITION_MODES)[number];

export const TIME_WINDOW_PRESETS = ["last7d", "last30d", "last90d", "last365d", "all"] as const;
export type TimeWindowPreset = (typeof TIME_WINDOW_PRESETS)[number];

export const DISPLAY_FIELD_KEYS = [
  "title",
  "creator",
  "game",
  "date",
  "viewCount",
  "duration",
] as const;
export type DisplayFieldKey = (typeof DISPLAY_FIELD_KEYS)[number];

export interface ClipDisplayFieldLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
}

/** Persisted on the main clip `overlay_items` row only (clip source + playback; no per-field data). */
export interface ClipsWidgetItemConfig {
  sourceMode: ClipSourceMode;
  folderIds: number[];
  gameIds: string[];
  creatorIds: string[];
  timeWindow: TimeWindowPreset | "custom";
  customDateRange?: { start: string; end: string };
  sort: ClipSortOption;
  maxClips: number;
  minViewCount: number;
  isFeaturedOnly: boolean;
  refreshIntervalSeconds: number;
  /** Muted by default so autoplay works in browsers; unmute for audible playback in OBS. */
  clipMuted: boolean;
  /** 0–1, applied when not muted. */
  clipVolume: number;
  /** How the player switches to the next clip (end of video or skip). */
  clipTransition: ClipTransitionMode;
  /** Crossfade length in ms; used when `clipTransition === "crossfade"`. */
  clipTransitionMs: number;
}

/** Saved on `overlay_items` rows with `type === "clip_display_field"`, linked to the parent clip widget. */
export interface ClipDisplayFieldItemConfig {
  parentClipItemId: string;
  fieldKey: DisplayFieldKey;
  /** Lower sorts behind; higher draws on top inside the clip widget. */
  stackOrder: number;
  layout: ClipDisplayFieldLayout;
  isLayoutLocked: boolean;
}

/** Typography shared by text and timer (and similar) widgets. */
export interface OverlayTextStyle {
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  fontWeight: 400 | 500 | 600 | 700;
  /** Google Font family name (see fonts.google.com). */
  fontFamily: GoogleFontFamily;
}

/** Persisted on `overlay_items` rows with `type === "text_widget"`. */
export interface TextWidgetItemConfig extends OverlayTextStyle {
  text: string;
}

export const TIMER_COUNTDOWN_MODES = ["duration", "absolute"] as const;
export type TimerCountdownMode = (typeof TIMER_COUNTDOWN_MODES)[number];

export const CLOCK_DATE_STYLES = ["short", "medium", "long"] as const;
export type ClockDateStyle = (typeof CLOCK_DATE_STYLES)[number];
export const CLOCK_TIME_STYLES = ["short", "medium", "long"] as const;
export type ClockTimeStyle = (typeof CLOCK_TIME_STYLES)[number];
export const CLOCK_LAYOUT_MODES = ["inline", "stacked"] as const;
export type ClockLayoutMode = (typeof CLOCK_LAYOUT_MODES)[number];

/** Countdown: either a fixed length from first paint / load, or a wall-clock target. */
export interface TimerWidgetItemConfig extends OverlayTextStyle {
  countdownMode: TimerCountdownMode;
  /**
   * When `countdownMode === "duration"`: length of the countdown after the overlay loads
   * (each page load starts a new countdown).
   */
  durationSeconds: number;
  /** When `countdownMode === "absolute"`: ISO 8601 instant to count down to. */
  targetAtIso: string;
  /** Shown when the countdown reaches zero. */
  finishedText: string;
}

/** Live clock / date-time for the viewer's wall clock (optionally a specific IANA time zone). */
export interface ClockWidgetItemConfig extends OverlayTextStyle {
  /** IANA zone, e.g. `Europe/Amsterdam`. Empty = each viewer's local time. */
  timeZone: string;
  showDate: boolean;
  showTime: boolean;
  dateStyle: ClockDateStyle;
  timeStyle: ClockTimeStyle;
  hour12: boolean;
  /** Uses a longer time pattern so seconds are visible where the locale supports it. */
  showSeconds: boolean;
  /** `stacked` shows date above time when both are enabled. */
  layout: ClockLayoutMode;
}

/** Persisted on `overlay_items` rows with any `irl_*_widget` type. */
export interface IrlFieldWidgetItemConfig extends OverlayTextStyle {
  /** Only meaningful when `item.type === "irl_speed_widget"`. */
  unit: "kmh" | "mph";
  mockData: boolean;
}

export const DEFAULT_IRL_FIELD_WIDGET_ITEM_CONFIG: IrlFieldWidgetItemConfig = {
  unit: "kmh",
  mockData: false,
  fontSize: 28,
  color: "#ffffff",
  align: "left",
  fontWeight: 600,
  fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
};

/** Raw GPS data sent from the phone over WebSocket. */
export interface GeoPayload {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number;
  timestamp: number;
}

/** @deprecated Use OverlaySocketMessage from @repo/types instead. */
export type IrlSocketMessage =
  | { type: "streamwizard.geo"; payload: GeoPayload }
  | { type: "streamwizard.status"; payload: { status: "offline" } };

/** Config for a custom user-authored widget placed on an overlay scene. */
export interface CustomWidgetItemConfig {
  widget_id: string;
  instance_id: string;
}

export const DEFAULT_CUSTOM_WIDGET_ITEM_CONFIG: CustomWidgetItemConfig = {
  widget_id: "",
  instance_id: "",
};

export type OverlayItemConfig =
  | ClipsWidgetItemConfig
  | ClipDisplayFieldItemConfig
  | TextWidgetItemConfig
  | TimerWidgetItemConfig
  | ClockWidgetItemConfig
  | IrlFieldWidgetItemConfig
  | CustomWidgetItemConfig;

/**
 * Flattened shape used by the clip preview, API, and query builder: parent row + display field children merged.
 */
export type ClipsWidgetConfig = ClipsWidgetItemConfig & {
  displayFields: Record<DisplayFieldKey, boolean>;
  displayFieldLayouts: Record<DisplayFieldKey, ClipDisplayFieldLayout>;
  displayFieldLocks: Record<DisplayFieldKey, boolean>;
  displayFieldOrder: DisplayFieldKey[];
};

export interface OverlayItem {
  id: string;
  scene_id: string;
  type: OverlayItemType;
  x: number;
  y: number;
  w: number;
  h: number;
  z_index: number;
  rotation: number;
  opacity: number;
  is_visible: boolean;
  is_locked: boolean;
  label: string;
  config: OverlayItemConfig;
}

export interface OverlayScene {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  subscriber_token: string;
  width: number;
  height: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OverlaySceneWithItems extends OverlayScene {
  items: OverlayItem[];
}

export const DEFAULT_TEXT_WIDGET_ITEM_CONFIG: TextWidgetItemConfig = {
  text: "Your text here",
  fontSize: 24,
  color: "#ffffff",
  align: "left",
  fontWeight: 400,
  fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
};

/** Defaults for new timer rows (absolute target is a sensible placeholder if you switch mode). */
export const TIMER_WIDGET_CONFIG_DEFAULTS: TimerWidgetItemConfig = {
  countdownMode: "duration",
  durationSeconds: 300,
  targetAtIso: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  finishedText: "We're live!",
  fontSize: 36,
  color: "#ffffff",
  align: "center",
  fontWeight: 600,
  fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
};

export function createDefaultTimerWidgetConfig(): TimerWidgetItemConfig {
  return {
    ...TIMER_WIDGET_CONFIG_DEFAULTS,
    targetAtIso: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Coerce persisted / partial timer config (including rows from before `countdownMode` existed).
 */
export function normalizeTimerWidgetConfig(
  config: OverlayItemConfig | Record<string, unknown>
): TimerWidgetItemConfig {
  const r = config as Partial<TimerWidgetItemConfig> & Record<string, unknown>;
  const base = createDefaultTimerWidgetConfig();

  const merged: TimerWidgetItemConfig = {
    ...base,
    ...r,
    fontFamily: resolvedTextWidgetFontFamily(r),
    finishedText:
      typeof r.finishedText === "string" ? r.finishedText : base.finishedText,
    fontSize:
      typeof r.fontSize === "number" && r.fontSize >= 8 ? r.fontSize : base.fontSize,
    color: typeof r.color === "string" ? r.color : base.color,
    align:
      r.align === "left" || r.align === "center" || r.align === "right"
        ? r.align
        : base.align,
    fontWeight:
      r.fontWeight === 400 ||
      r.fontWeight === 500 ||
      r.fontWeight === 600 ||
      r.fontWeight === 700
        ? r.fontWeight
        : base.fontWeight,
  };

  if (
    merged.countdownMode !== "duration" &&
    merged.countdownMode !== "absolute"
  ) {
    merged.countdownMode =
      typeof r.targetAtIso === "string" &&
      r.targetAtIso.length > 0 &&
      !Number.isNaN(Date.parse(r.targetAtIso))
        ? "absolute"
        : "duration";
  }

  if (
    typeof r.durationSeconds !== "number" ||
    !Number.isFinite(r.durationSeconds)
  ) {
    merged.durationSeconds = base.durationSeconds;
  }
  merged.durationSeconds = Math.round(
    Math.max(10, Math.min(604800, merged.durationSeconds))
  );

  if (
    typeof merged.targetAtIso !== "string" ||
    merged.targetAtIso.length === 0 ||
    Number.isNaN(Date.parse(merged.targetAtIso))
  ) {
    merged.targetAtIso = base.targetAtIso;
  }

  return merged;
}

export const DEFAULT_CLIPS_WIDGET_ITEM_CONFIG: ClipsWidgetItemConfig = {
  sourceMode: "all",
  folderIds: [],
  gameIds: [],
  creatorIds: [],
  timeWindow: "last30d",
  sort: "newest",
  maxClips: 20,
  minViewCount: 0,
  isFeaturedOnly: false,
  refreshIntervalSeconds: 300,
  clipMuted: false,
  clipVolume: 1,
  clipTransition: "cut",
  clipTransitionMs: 600,
};

/** Default composite (parent + implicit field defaults) for previews and fallbacks. */
export const DEFAULT_CLIPS_WIDGET_CONFIG: ClipsWidgetConfig = {
  ...DEFAULT_CLIPS_WIDGET_ITEM_CONFIG,
  displayFields: {
    title: true,
    creator: true,
    game: true,
    date: true,
    viewCount: false,
    duration: true,
  },
  displayFieldLayouts: {
    title: { x: 3, y: 72, w: 70, h: 10, fontSize: 18 },
    creator: { x: 3, y: 83, w: 35, h: 8, fontSize: 14 },
    game: { x: 40, y: 83, w: 30, h: 8, fontSize: 14 },
    date: { x: 72, y: 83, w: 25, h: 8, fontSize: 14 },
    viewCount: { x: 3, y: 92, w: 28, h: 7, fontSize: 12 },
    duration: { x: 33, y: 92, w: 18, h: 7, fontSize: 12 },
  },
  displayFieldLocks: {
    title: false,
    creator: false,
    game: false,
    date: false,
    viewCount: false,
    duration: false,
  },
  displayFieldOrder: [...DISPLAY_FIELD_KEYS],
};

export function isClipDisplayFieldItem(item: OverlayItem): boolean {
  return item.type === "clip_display_field";
}

export function asClipDisplayFieldConfig(
  config: OverlayItemConfig
): ClipDisplayFieldItemConfig {
  return config as ClipDisplayFieldItemConfig;
}

export function isTextWidgetItem(item: OverlayItem): boolean {
  return item.type === "text_widget";
}

export function asTextWidgetConfig(
  config: OverlayItemConfig
): TextWidgetItemConfig {
  return config as TextWidgetItemConfig;
}

export function isTimerWidgetItem(item: OverlayItem): boolean {
  return item.type === "timer_widget";
}

export function asTimerWidgetConfig(
  config: OverlayItemConfig
): TimerWidgetItemConfig {
  return config as TimerWidgetItemConfig;
}

export function isClockWidgetItem(item: OverlayItem): boolean {
  return item.type === "clock_widget";
}

export function asClockWidgetConfig(
  config: OverlayItemConfig
): ClockWidgetItemConfig {
  return config as ClockWidgetItemConfig;
}

export function asCustomWidgetConfig(
  config: OverlayItemConfig
): CustomWidgetItemConfig {
  return config as CustomWidgetItemConfig;
}

/** Runtime-safe family for editors / renderers (older rows may omit `fontFamily`). */
export function resolvedTextWidgetFontFamily(cfg: {
  fontFamily?: string;
}): GoogleFontFamily {
  const f = cfg.fontFamily;
  return typeof f === "string" && isValidGoogleFontFamilyName(f)
    ? f.trim()
    : DEFAULT_GOOGLE_FONT_FAMILY;
}

export const DEFAULT_CLOCK_WIDGET_ITEM_CONFIG: ClockWidgetItemConfig = {
  fontSize: 28,
  color: "#ffffff",
  align: "center",
  fontWeight: 600,
  fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
  timeZone: "",
  showDate: true,
  showTime: true,
  dateStyle: "medium",
  timeStyle: "short",
  hour12: false,
  showSeconds: true,
  layout: "inline",
};

export function normalizeClockWidgetConfig(
  config: OverlayItemConfig | Record<string, unknown>
): ClockWidgetItemConfig {
  const r = config as Partial<ClockWidgetItemConfig> & Record<string, unknown>;
  const base = DEFAULT_CLOCK_WIDGET_ITEM_CONFIG;

  const merged: ClockWidgetItemConfig = {
    ...base,
    ...r,
    fontFamily: resolvedTextWidgetFontFamily(r),
    fontSize:
      typeof r.fontSize === "number" && r.fontSize >= 8 ? r.fontSize : base.fontSize,
    color: typeof r.color === "string" ? r.color : base.color,
    align:
      r.align === "left" || r.align === "center" || r.align === "right"
        ? r.align
        : base.align,
    fontWeight:
      r.fontWeight === 400 ||
      r.fontWeight === 500 ||
      r.fontWeight === 600 ||
      r.fontWeight === 700
        ? r.fontWeight
        : base.fontWeight,
    timeZone: typeof r.timeZone === "string" ? r.timeZone : base.timeZone,
    showDate: typeof r.showDate === "boolean" ? r.showDate : base.showDate,
    showTime: typeof r.showTime === "boolean" ? r.showTime : base.showTime,
    dateStyle:
      r.dateStyle === "short" || r.dateStyle === "medium" || r.dateStyle === "long"
        ? r.dateStyle
        : base.dateStyle,
    timeStyle:
      r.timeStyle === "short" || r.timeStyle === "medium" || r.timeStyle === "long"
        ? r.timeStyle
        : base.timeStyle,
    hour12: typeof r.hour12 === "boolean" ? r.hour12 : base.hour12,
    showSeconds:
      typeof r.showSeconds === "boolean" ? r.showSeconds : base.showSeconds,
    layout: r.layout === "stacked" ? "stacked" : base.layout,
  };

  if (!merged.showDate && !merged.showTime) {
    merged.showTime = true;
  }

  return merged;
}

export function getClipDisplayChildren(
  items: OverlayItem[],
  parentId: string
): OverlayItem[] {
  return items.filter(
    (i) =>
      i.type === "clip_display_field" &&
      asClipDisplayFieldConfig(i.config).parentClipItemId === parentId
  );
}

export function slimClipsWidgetItemConfig(raw: unknown): ClipsWidgetItemConfig {
  const c = raw as Partial<ClipsWidgetItemConfig> & Partial<ClipsWidgetConfig>;
  const transitionRaw = c.clipTransition;
  const clipTransition =
    transitionRaw === "crossfade" || transitionRaw === "cut"
      ? transitionRaw
      : DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.clipTransition;
  const msRaw =
    c.clipTransitionMs ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.clipTransitionMs;
  const clipTransitionMs = Math.min(3000, Math.max(200, Math.round(msRaw)));
  return {
    sourceMode: c.sourceMode ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.sourceMode,
    folderIds: c.folderIds ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.folderIds,
    gameIds: c.gameIds ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.gameIds,
    creatorIds: c.creatorIds ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.creatorIds,
    timeWindow: c.timeWindow ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.timeWindow,
    customDateRange: c.customDateRange,
    sort: c.sort ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.sort,
    maxClips: c.maxClips ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.maxClips,
    minViewCount: c.minViewCount ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.minViewCount,
    isFeaturedOnly:
      c.isFeaturedOnly ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.isFeaturedOnly,
    refreshIntervalSeconds:
      c.refreshIntervalSeconds ??
      DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.refreshIntervalSeconds,
    clipMuted: c.clipMuted ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.clipMuted,
    clipVolume: c.clipVolume ?? DEFAULT_CLIPS_WIDGET_ITEM_CONFIG.clipVolume,
    clipTransition,
    clipTransitionMs,
  };
}

export function createClipDisplayFieldChildItems(
  sceneId: string,
  parentId: string,
  parent: Pick<OverlayItem, "x" | "y" | "w" | "h" | "z_index">,
  nextId: () => string
): OverlayItem[] {
  return DISPLAY_FIELD_KEYS.map((fieldKey, stackOrder) => ({
    id: nextId(),
    scene_id: sceneId,
    type: "clip_display_field" as const,
    x: parent.x,
    y: parent.y,
    w: parent.w,
    h: parent.h,
    z_index: parent.z_index,
    rotation: 0,
    opacity: 1,
    is_visible: DEFAULT_CLIPS_WIDGET_CONFIG.displayFields[fieldKey],
    is_locked: false,
    label: `Display · ${fieldKey}`,
    config: {
      parentClipItemId: parentId,
      fieldKey,
      stackOrder,
      layout: { ...DEFAULT_CLIPS_WIDGET_CONFIG.displayFieldLayouts[fieldKey] },
      isLayoutLocked: DEFAULT_CLIPS_WIDGET_CONFIG.displayFieldLocks[fieldKey],
    },
  }));
}

export function buildCompositeClipsConfig(
  parent: OverlayItem,
  allItems: OverlayItem[]
): ClipsWidgetConfig {
  const base = slimClipsWidgetItemConfig(parent.config);

  const children = getClipDisplayChildren(allItems, parent.id).slice();
  const parentLegacy = parent.config as Partial<ClipsWidgetConfig>;

  if (children.length === 0 && parentLegacy.displayFields) {
    return {
      ...DEFAULT_CLIPS_WIDGET_CONFIG,
      ...base,
      displayFields: parentLegacy.displayFields as ClipsWidgetConfig["displayFields"],
      displayFieldLayouts:
        parentLegacy.displayFieldLayouts ??
        DEFAULT_CLIPS_WIDGET_CONFIG.displayFieldLayouts,
      displayFieldLocks:
        parentLegacy.displayFieldLocks ??
        DEFAULT_CLIPS_WIDGET_CONFIG.displayFieldLocks,
      displayFieldOrder: resolvedDisplayFieldOrder(parentLegacy),
    };
  }

  if (children.length === 0) {
    return {
      ...DEFAULT_CLIPS_WIDGET_CONFIG,
      ...base,
    };
  }

  children.sort(
    (a, b) =>
      asClipDisplayFieldConfig(a.config).stackOrder -
      asClipDisplayFieldConfig(b.config).stackOrder
  );

  const displayFields = { ...DEFAULT_CLIPS_WIDGET_CONFIG.displayFields };
  const displayFieldLayouts = {
    ...DEFAULT_CLIPS_WIDGET_CONFIG.displayFieldLayouts,
  };
  const displayFieldLocks = { ...DEFAULT_CLIPS_WIDGET_CONFIG.displayFieldLocks };

  for (const c of children) {
    const fc = asClipDisplayFieldConfig(c.config);
    displayFields[fc.fieldKey] = c.is_visible;
    displayFieldLayouts[fc.fieldKey] = { ...fc.layout };
    displayFieldLocks[fc.fieldKey] = fc.isLayoutLocked;
  }

  const displayFieldOrder =
    children.length === DISPLAY_FIELD_KEYS.length &&
    new Set(children.map((c) => asClipDisplayFieldConfig(c.config).fieldKey))
      .size === DISPLAY_FIELD_KEYS.length
      ? children.map((c) => asClipDisplayFieldConfig(c.config).fieldKey)
      : resolvedDisplayFieldOrder({});

  return {
    ...DEFAULT_CLIPS_WIDGET_CONFIG,
    ...base,
    displayFields,
    displayFieldLayouts,
    displayFieldLocks,
    displayFieldOrder,
  };
}

export function resolvedDisplayFieldOrder(
  config: Partial<Pick<ClipsWidgetConfig, "displayFieldOrder">>
): DisplayFieldKey[] {
  const o = config.displayFieldOrder;
  if (
    o &&
    o.length === DISPLAY_FIELD_KEYS.length &&
    new Set(o).size === DISPLAY_FIELD_KEYS.length
  ) {
    return [...o];
  }
  return [...DISPLAY_FIELD_KEYS];
}

export function resolvedDisplayFieldLocks(
  config: Partial<Pick<ClipsWidgetConfig, "displayFieldLocks">>
): Record<DisplayFieldKey, boolean> {
  return {
    ...DEFAULT_CLIPS_WIDGET_CONFIG.displayFieldLocks,
    ...config.displayFieldLocks,
  };
}

/**
 * Normalized clip data passed to `ClipsWidgetRenderer`.
 * The renderer never fetches clips — containers map their data source to this shape.
 */
export interface ClipDataRow {
  clipId: string;
  broadcasterId: string;
  title: string;
  creatorName: string;
  gameName: string | null;
  createdAtTwitch: string;
  viewCount: number | null;
  durationSec: number | null;
}

/** DB row shape from `overlay_items` before typing `type` / `config`. */
export interface OverlayItemDbRow {
  id: string;
  scene_id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z_index: number;
  rotation: number;
  opacity: number;
  is_visible: boolean;
  is_locked: boolean;
  label: string;
  config: unknown;
}

export function overlayItemFromDbRow(row: OverlayItemDbRow): OverlayItem {
  return {
    ...row,
    type: row.type as OverlayItem["type"],
    config: row.config as OverlayItemConfig,
  };
}

/**
 * Public overlay API: one row per root widget. Clip display fields are merged
 * into the parent `clips_widget` config; child rows are omitted.
 */
export function toPublicOverlayApiItems(all: OverlayItem[]) {
  return all
    .filter((i) => i.type !== "clip_display_field")
    .map((item) => ({
      id: item.id,
      type: item.type,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      z_index: item.z_index,
      rotation: item.rotation,
      opacity: item.opacity,
      is_visible: item.is_visible,
      label: item.label,
      config:
        item.type === "clips_widget"
          ? buildCompositeClipsConfig(item, all)
          : item.config,
    }));
}
