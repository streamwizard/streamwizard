import { buildWidgetTestEvent, type WidgetTestEventType } from "@repo/schemas";
import {
  DEFAULT_GOOGLE_FONT_FAMILY,
  resolvedTextWidgetFontFamily,
  type GoogleFontFamily,
  type OverlayItemConfig,
} from "../../types";

// ─── Event types ────────────────────────────────────────────────────────────

/** Alert categories a streamer can configure independently. */
export const ALERT_EVENT_TYPES = [
  "follow",
  "sub",
  "resub",
  "gift_sub",
  "cheer",
  "raid",
] as const;
export type AlertEventType = (typeof ALERT_EVENT_TYPES)[number];

export const ALERT_EVENT_LABELS: Record<AlertEventType, string> = {
  follow: "Follow",
  sub: "Sub",
  resub: "Resub",
  gift_sub: "Gift sub",
  cheer: "Cheer",
  raid: "Raid",
};

/**
 * What `{amount}` means per event (used for threshold labels and template
 * hints in the editor). Follow/sub have no amount.
 */
export const ALERT_AMOUNT_LABELS: Record<AlertEventType, string | null> = {
  follow: null,
  sub: null,
  resub: "months",
  gift_sub: "gifts",
  cheer: "bits",
  raid: "viewers",
};

// ─── Config ─────────────────────────────────────────────────────────────────

export const ALERT_MEDIA_KINDS = ["", "image", "video"] as const;
export type AlertMediaKind = (typeof ALERT_MEDIA_KINDS)[number];

export const ALERT_LAYOUTS = ["stacked", "row", "overlay"] as const;
/** stacked: media above text · row: media beside text · overlay: text over media */
export type AlertLayout = (typeof ALERT_LAYOUTS)[number];

export const ALERT_ANIMATIONS_IN = [
  "fade",
  "slide_up",
  "slide_down",
  "zoom",
  "bounce",
] as const;
export type AlertAnimationIn = (typeof ALERT_ANIMATIONS_IN)[number];

export const ALERT_ANIMATIONS_OUT = ["fade", "slide_down", "zoom"] as const;
export type AlertAnimationOut = (typeof ALERT_ANIMATIONS_OUT)[number];

/** Everything about one alert type — media, copy, timing and look & feel. */
export interface AlertVariantConfig {
  enabled: boolean;
  /** CDN URL from the media library. Empty = no media. */
  mediaUrl: string;
  mediaKind: AlertMediaKind;
  /** CDN URL from the media library. Empty = no sound. */
  soundUrl: string;
  /** 0–1. Applies to both the sound file and video audio for this event. */
  volume: number;
  /** e.g. `{name} just followed!` */
  titleTemplate: string;
  /** Secondary line; empty = hidden. `{message}` shows the viewer's message. */
  messageTemplate: string;
  /** Seconds on screen. */
  durationSeconds: number;
  /** Minimum bits / viewers / gifts / months before this alert fires. 0 = all. */
  minAmount: number;

  layout: AlertLayout;
  animationIn: AlertAnimationIn;
  animationOut: AlertAnimationOut;

  fontFamily: GoogleFontFamily;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  align: "left" | "center" | "right";
  titleColor: string;
  messageColor: string;
  /** Highlights `{name}` and `{amount}` inside the title. */
  accentColor: string;
  textShadow: boolean;
}

export interface AlertWidgetItemConfig {
  /** Quiet gap between queued alerts. */
  gapSeconds: number;
  /** Master volume 0–1, multiplied with each variant's volume. */
  masterVolume: number;

  variants: Record<AlertEventType, AlertVariantConfig>;
}

export const DEFAULT_ALERT_VARIANT_TITLES: Record<AlertEventType, string> = {
  follow: "{name} just followed!",
  sub: "{name} just subscribed!",
  resub: "{name} resubscribed for {amount} months!",
  gift_sub: "{name} gifted {amount} subs!",
  cheer: "{name} cheered {amount} bits!",
  raid: "{name} is raiding with {amount} viewers!",
};

const DEFAULT_ALERT_VARIANT_MESSAGES: Record<AlertEventType, string> = {
  follow: "",
  sub: "",
  resub: "{message}",
  gift_sub: "",
  cheer: "{message}",
  raid: "",
};

export function createDefaultAlertVariantConfig(
  event: AlertEventType
): AlertVariantConfig {
  return {
    enabled: true,
    mediaUrl: "",
    mediaKind: "",
    soundUrl: "",
    volume: 0.8,
    titleTemplate: DEFAULT_ALERT_VARIANT_TITLES[event],
    messageTemplate: DEFAULT_ALERT_VARIANT_MESSAGES[event],
    durationSeconds: 6,
    minAmount: 0,
    layout: "stacked",
    animationIn: "zoom",
    animationOut: "fade",
    fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
    fontSize: 32,
    fontWeight: 700,
    align: "center",
    titleColor: "#ffffff",
    messageColor: "#d4d4d8",
    accentColor: "#9e7aff",
    textShadow: true,
  };
}

export function createDefaultAlertWidgetConfig(): AlertWidgetItemConfig {
  return {
    gapSeconds: 1,
    masterVolume: 0.8,
    variants: Object.fromEntries(
      ALERT_EVENT_TYPES.map((e) => [e, createDefaultAlertVariantConfig(e)])
    ) as Record<AlertEventType, AlertVariantConfig>,
  };
}

const clamp01 = (n: unknown, fallback: number) =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.min(1, Math.max(0, n))
    : fallback;

const oneOf = <T extends string>(
  options: readonly string[],
  value: unknown,
  fallback: T
): T => ((options as readonly string[]).includes(value as string) ? (value as T) : fallback);

/**
 * Look & feel used to live on the widget instead of per event type. Older saved
 * configs still carry it there, so each variant inherits those values as its
 * base before its own overrides apply.
 */
function variantBaseFromLegacy(
  event: AlertEventType,
  legacy: Record<string, unknown>
): AlertVariantConfig {
  const base = createDefaultAlertVariantConfig(event);
  return {
    ...base,
    mediaUrl: typeof legacy.mediaUrl === "string" ? legacy.mediaUrl : base.mediaUrl,
    mediaKind:
      legacy.mediaKind === "image" || legacy.mediaKind === "video"
        ? legacy.mediaKind
        : base.mediaKind,
    soundUrl: typeof legacy.soundUrl === "string" ? legacy.soundUrl : base.soundUrl,
    durationSeconds:
      typeof legacy.durationSeconds === "number" && Number.isFinite(legacy.durationSeconds)
        ? Math.min(60, Math.max(1, Math.round(legacy.durationSeconds)))
        : base.durationSeconds,
    layout: oneOf(ALERT_LAYOUTS, legacy.layout, base.layout),
    animationIn: oneOf(ALERT_ANIMATIONS_IN, legacy.animationIn, base.animationIn),
    animationOut: oneOf(ALERT_ANIMATIONS_OUT, legacy.animationOut, base.animationOut),
    fontFamily:
      typeof legacy.fontFamily === "string"
        ? resolvedTextWidgetFontFamily(legacy as { fontFamily?: string })
        : base.fontFamily,
    fontSize:
      typeof legacy.fontSize === "number" && legacy.fontSize >= 8 && legacy.fontSize <= 200
        ? Math.round(legacy.fontSize)
        : base.fontSize,
    fontWeight:
      legacy.fontWeight === 400 ||
      legacy.fontWeight === 500 ||
      legacy.fontWeight === 600 ||
      legacy.fontWeight === 700
        ? legacy.fontWeight
        : base.fontWeight,
    align: oneOf(["left", "center", "right"], legacy.align, base.align),
    titleColor: typeof legacy.titleColor === "string" ? legacy.titleColor : base.titleColor,
    messageColor:
      typeof legacy.messageColor === "string" ? legacy.messageColor : base.messageColor,
    accentColor:
      typeof legacy.accentColor === "string" ? legacy.accentColor : base.accentColor,
    textShadow:
      typeof legacy.textShadow === "boolean" ? legacy.textShadow : base.textShadow,
  };
}

function normalizeAlertVariant(
  raw: unknown,
  event: AlertEventType,
  legacy: Record<string, unknown> = {}
): AlertVariantConfig {
  const base = variantBaseFromLegacy(event, legacy);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<AlertVariantConfig> & Record<string, unknown>;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : base.enabled,
    // Media is per event now; an empty variant URL means "no media", except on
    // legacy configs where the shared media becomes this variant's base.
    mediaUrl: typeof r.mediaUrl === "string" && r.mediaUrl ? r.mediaUrl : base.mediaUrl,
    mediaKind:
      typeof r.mediaUrl === "string" && r.mediaUrl
        ? r.mediaKind === "image" || r.mediaKind === "video"
          ? r.mediaKind
          : ""
        : base.mediaKind,
    soundUrl: typeof r.soundUrl === "string" && r.soundUrl ? r.soundUrl : base.soundUrl,
    volume: clamp01(r.volume, base.volume),
    titleTemplate:
      typeof r.titleTemplate === "string" && r.titleTemplate.length <= 200
        ? r.titleTemplate
        : base.titleTemplate,
    messageTemplate:
      typeof r.messageTemplate === "string" && r.messageTemplate.length <= 200
        ? r.messageTemplate
        : base.messageTemplate,
    // 0 used to mean "inherit the widget duration" — keep those alerts sane.
    durationSeconds:
      typeof r.durationSeconds === "number" &&
      Number.isFinite(r.durationSeconds) &&
      r.durationSeconds > 0
        ? Math.min(60, Math.max(1, Math.round(r.durationSeconds)))
        : base.durationSeconds,
    minAmount:
      typeof r.minAmount === "number" && Number.isFinite(r.minAmount)
        ? Math.max(0, Math.round(r.minAmount))
        : base.minAmount,
    layout: oneOf(ALERT_LAYOUTS, r.layout, base.layout),
    animationIn: oneOf(ALERT_ANIMATIONS_IN, r.animationIn, base.animationIn),
    animationOut: oneOf(ALERT_ANIMATIONS_OUT, r.animationOut, base.animationOut),
    fontFamily:
      typeof r.fontFamily === "string"
        ? resolvedTextWidgetFontFamily(r as { fontFamily?: string })
        : base.fontFamily,
    fontSize:
      typeof r.fontSize === "number" && r.fontSize >= 8 && r.fontSize <= 200
        ? Math.round(r.fontSize)
        : base.fontSize,
    fontWeight:
      r.fontWeight === 400 ||
      r.fontWeight === 500 ||
      r.fontWeight === 600 ||
      r.fontWeight === 700
        ? r.fontWeight
        : base.fontWeight,
    align: oneOf(["left", "center", "right"], r.align, base.align),
    titleColor: typeof r.titleColor === "string" ? r.titleColor : base.titleColor,
    messageColor:
      typeof r.messageColor === "string" ? r.messageColor : base.messageColor,
    accentColor:
      typeof r.accentColor === "string" ? r.accentColor : base.accentColor,
    textShadow: typeof r.textShadow === "boolean" ? r.textShadow : base.textShadow,
  };
}

/** Coerce persisted / partial config to a complete, safe shape. */
export function normalizeAlertWidgetConfig(
  config: OverlayItemConfig | Record<string, unknown> | null | undefined
): AlertWidgetItemConfig {
  const base = createDefaultAlertWidgetConfig();
  if (!config || typeof config !== "object") return base;
  const r = config as Partial<AlertWidgetItemConfig> & Record<string, unknown>;

  const variantsRaw = (r.variants ?? {}) as Record<string, unknown>;

  return {
    gapSeconds:
      typeof r.gapSeconds === "number" && Number.isFinite(r.gapSeconds)
        ? Math.min(30, Math.max(0, Math.round(r.gapSeconds)))
        : base.gapSeconds,
    masterVolume: clamp01(r.masterVolume, base.masterVolume),
    variants: Object.fromEntries(
      ALERT_EVENT_TYPES.map((e) => [
        e,
        normalizeAlertVariant(variantsRaw[e], e, r as Record<string, unknown>),
      ])
    ) as Record<AlertEventType, AlertVariantConfig>,
  };
}

// ─── Incoming event mapping ─────────────────────────────────────────────────

/** Normalized alert instance the renderer plays. */
export interface AlertInstance {
  event: AlertEventType;
  name: string;
  /** bits / viewers / gifts / months; 0 when the event has no amount. */
  amount: number;
  /** Viewer-typed message (cheer / resub); empty otherwise. */
  message: string;
}

/**
 * Map a raw overlay socket message (EventSub shape) to an alert instance.
 * Returns null for message types the alert box doesn't handle.
 */
export function alertInstanceFromSocketMessage(msg: {
  type?: string;
  payload?: unknown;
}): AlertInstance | null {
  const p = (msg.payload ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : 0;

  switch (msg.type) {
    case "channel.follow":
      return { event: "follow", name: str(p.user_name), amount: 0, message: "" };
    case "channel.subscribe":
      // Gifted subs arrive as channel.subscription.gift too; skip the per-
      // recipient subscribe event so one gift bomb doesn't fire twice.
      if (p.is_gift === true) return null;
      return { event: "sub", name: str(p.user_name), amount: 0, message: "" };
    case "channel.subscription.message": {
      const m = (p.message ?? {}) as Record<string, unknown>;
      return {
        event: "resub",
        name: str(p.user_name),
        amount: num(p.cumulative_months),
        message: str(m.text),
      };
    }
    case "channel.subscription.gift":
      return {
        event: "gift_sub",
        name: p.is_anonymous === true ? "Anonymous" : str(p.user_name) || "Anonymous",
        amount: num(p.total),
        message: "",
      };
    case "channel.cheer":
      return {
        event: "cheer",
        name: p.is_anonymous === true ? "Anonymous" : str(p.user_name) || "Anonymous",
        amount: num(p.bits),
        message: str(p.message),
      };
    case "channel.raid":
      return {
        event: "raid",
        name: str(p.from_broadcaster_user_name),
        amount: num(p.viewers),
        message: "",
      };
    default:
      return null;
  }
}

/** Renders `{name}` / `{amount}` / `{message}` inside a template. */
export function renderAlertTemplate(
  template: string,
  alert: AlertInstance
): string {
  return template
    .replaceAll("{name}", alert.name)
    .replaceAll("{amount}", String(alert.amount))
    .replaceAll("{message}", alert.message);
}

// ─── Test events ────────────────────────────────────────────────────────────

/** Maps a configurable alert category onto the EventSub type it is driven by. */
export const ALERT_EVENT_SUBSCRIPTION_TYPES: Record<AlertEventType, WidgetTestEventType> = {
  follow: "channel.follow",
  sub: "channel.subscribe",
  resub: "channel.subscription.message",
  gift_sub: "channel.subscription.gift",
  cheer: "channel.cheer",
  raid: "channel.raid",
};

/**
 * Synthetic EventSub payload for a test alert. The message `type` matches the
 * real subscription type so custom widgets react to tests exactly like SE.
 * Used by the editor's local preview and the send-to-stream server action.
 *
 * Payloads live in `@repo/schemas` alongside every other test fixture, where a
 * test asserts each one still parses against its zod schema.
 */
export function buildTestAlertSocketMessage(
  event: AlertEventType,
  userName = "StreamWizard"
): { type: string; payload: Record<string, unknown> } {
  return buildWidgetTestEvent(ALERT_EVENT_SUBSCRIPTION_TYPES[event], { userName });
}

/**
 * Browser event the editor uses to fire a local-only test alert into canvas
 * previews (no server round-trip). detail: `{ sceneId, event }`.
 */
export const ALERT_TEST_BROWSER_EVENT = "streamwizard:test-alert";

export interface AlertTestBrowserEventDetail {
  sceneId: string;
  event: AlertEventType;
}
