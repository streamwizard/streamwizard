import { buildWidgetTestEvent, type WidgetTestEventType } from "@repo/schemas";
import {
  ALERT_ENTER_ANIMATIONS,
  ALERT_EXIT_ANIMATIONS,
  ALERT_HIGHLIGHT_ANIMATIONS,
  type AlertEnterAnimation,
  type AlertExitAnimation,
  type AlertHighlightAnimation,
} from "./alert-animations";
import {
  DEFAULT_GOOGLE_FONT_FAMILY,
  resolvedTextWidgetFontFamily,
  type GoogleFontFamily,
  type OverlayItemConfig,
} from "../../types";

// ─── Event types ────────────────────────────────────────────────────────────

/**
 * Alert categories a streamer can configure independently, grouped and ordered
 * the way the public /overlays catalog groups them so the marketing page and
 * the settings panel read as the same product.
 *
 * Six more events from that catalog are missing on purpose -- ban, VIP added,
 * mod added, both predictions and goal achieved each need an OAuth scope
 * StreamWizard does not request yet, so shipping them means re-consent for
 * every existing user. They are tracked separately.
 */
export const ALERT_EVENT_CATEGORIES = [
  {
    id: "community",
    label: "Community",
    events: ["follow", "redemption", "watch_streak", "modiversary"],
  },
  {
    // Everything paid lives here, subs included -- same call the catalog makes.
    id: "money",
    label: "Money",
    events: [
      "sub",
      "resub",
      "gift_sub",
      "community_gift",
      "gift_upgrade",
      "prime_upgrade",
      "pay_it_forward",
      "cheer",
      "bits_badge",
      "charity_donation",
      "hype_train_start",
      "hype_train_end",
    ],
  },
  {
    id: "channel",
    label: "Channel",
    events: [
      "raid",
      "shoutout_received",
      "shoutout_sent",
      "announcement",
      "ad_break",
      "poll_start",
      "poll_winner",
    ],
  },
] as const;

export type AlertEventCategoryId = (typeof ALERT_EVENT_CATEGORIES)[number]["id"];

export const ALERT_EVENT_TYPES = ALERT_EVENT_CATEGORIES.flatMap(
  (c) => c.events
) as unknown as readonly (typeof ALERT_EVENT_CATEGORIES)[number]["events"][number][];

export type AlertEventType = (typeof ALERT_EVENT_TYPES)[number];

export const ALERT_EVENT_LABELS: Record<AlertEventType, string> = {
  follow: "Follow",
  redemption: "Reward redeemed",
  watch_streak: "Watch streak",
  modiversary: "Modiversary",
  sub: "Sub",
  resub: "Resub",
  gift_sub: "Gift sub",
  community_gift: "Gift bomb",
  gift_upgrade: "Gift upgrade",
  prime_upgrade: "Prime upgrade",
  pay_it_forward: "Pay it forward",
  cheer: "Cheer",
  bits_badge: "Bits badge",
  charity_donation: "Charity donation",
  hype_train_start: "Hype train start",
  hype_train_end: "Hype train end",
  raid: "Raid",
  shoutout_received: "Shoutout received",
  shoutout_sent: "Shoutout sent",
  announcement: "Announcement",
  ad_break: "Ad break",
  poll_start: "Poll start",
  poll_winner: "Poll winner",
};

/**
 * What `{amount}` means per event (used for threshold labels and template
 * hints in the editor). `null` for the events Twitch sends no number with.
 */
export const ALERT_AMOUNT_LABELS: Record<AlertEventType, string | null> = {
  follow: null,
  redemption: "points",
  watch_streak: "streams",
  // Twitch documents the modiversary notice but ships no payload object with
  // it, so there is no year to put in {amount}.
  modiversary: null,
  sub: null,
  resub: "months",
  gift_sub: "lifetime gifts",
  community_gift: "subs",
  gift_upgrade: null,
  prime_upgrade: null,
  pay_it_forward: null,
  cheer: "bits",
  bits_badge: "bits",
  charity_donation: "donation size",
  hype_train_start: "level",
  hype_train_end: "level",
  raid: "viewers",
  shoutout_received: "viewers",
  shoutout_sent: "viewers",
  announcement: null,
  ad_break: "seconds",
  poll_start: null,
  poll_winner: "votes",
};

/**
 * What `{name}` holds per event. It is the viewer on most of them, but a poll
 * has no viewer and a raid's subject is the raider -- the editor has to say
 * which, or half these templates read like a bug.
 */
export const ALERT_NAME_LABELS: Record<AlertEventType, string> = {
  follow: "the viewer",
  redemption: "the viewer",
  watch_streak: "the viewer",
  modiversary: "the mod",
  sub: "the viewer",
  resub: "the viewer",
  gift_sub: "the gifter",
  community_gift: "the gifter",
  gift_upgrade: "the viewer",
  prime_upgrade: "the viewer",
  pay_it_forward: "the viewer",
  cheer: "the viewer",
  bits_badge: "the viewer",
  charity_donation: "the donor",
  hype_train_start: "the top contributor",
  hype_train_end: "the top contributor",
  raid: "the raider",
  shoutout_received: "who shouted you out",
  shoutout_sent: "who you shouted out",
  announcement: "who announced it",
  ad_break: "your channel",
  poll_start: "the poll question",
  poll_winner: "the winning choice",
};

/**
 * The alerts that are on out of the box: the set every other alert provider
 * ships as standard. Everything else is off until the streamer turns it on.
 *
 * Two reasons. A new box should behave like the one a streamer is switching
 * from, not fire an ad-break notice nobody asked for. And a saved config from
 * before these events existed has no `enabled` for them, so it falls through
 * to this default -- an upgrade must not start firing sixteen new alerts at a
 * live stream.
 */
export const ALERT_DEFAULT_ON_EVENTS: readonly AlertEventType[] = [
  "follow",
  "sub",
  "resub",
  "gift_sub",
  "community_gift",
  "cheer",
  "raid",
];

/** Events whose payload carries something the viewer typed, for `{message}`. */
export const ALERT_MESSAGE_EVENTS: readonly AlertEventType[] = [
  "cheer",
  "resub",
  "announcement",
  "charity_donation",
  "redemption",
];

/**
 * Events that fill `{gifter}` with the ORIGINAL gifter's name. Both are gift
 * chains: the payload names who gave the sub being continued or passed on.
 */
export const ALERT_GIFTER_EVENTS: readonly AlertEventType[] = [
  "pay_it_forward",
  "gift_upgrade",
];

/**
 * Events that fill the `detail` field, and the token that reads it. One field,
 * three names: only ever one of them applies to a given event, and `{reward}`
 * on a charity alert would read like a bug.
 */
export const ALERT_DETAIL_TOKENS: Partial<
  Record<AlertEventType, "reward" | "charity" | "recipient">
> = {
  redemption: "reward",
  charity_donation: "charity",
  gift_sub: "recipient",
};

/** Events whose payload names a sub plan: what a tier condition reads. */
export const ALERT_TIER_EVENTS: readonly AlertEventType[] = [
  "sub",
  "resub",
  "gift_sub",
  "community_gift",
];

/**
 * Events where "the biggest one this stream" is a thing people celebrate. A
 * record watch streak or ad break is not, so those keep to exact / at least.
 */
export const ALERT_SESSION_TOP_EVENTS: readonly AlertEventType[] = [
  "cheer",
  "community_gift",
  "raid",
  "charity_donation",
];

/**
 * The alerts that take variations: every one that carries a number, plus sub
 * (for its tier) and modiversary (per mod -- Twitch sends no year with it, so
 * there is no "five years" to match on).
 *
 * The rest have nothing to tell one event from the next, so a variation on
 * them could only ever be a coin flip.
 */
export const ALERT_VARIATION_EVENTS: readonly AlertEventType[] = [
  "redemption",
  "watch_streak",
  "modiversary",
  "sub",
  "resub",
  "gift_sub",
  "community_gift",
  "cheer",
  "bits_badge",
  "charity_donation",
  "hype_train_start",
  "hype_train_end",
  "raid",
  "shoutout_received",
  "shoutout_sent",
  "ad_break",
  "poll_winner",
];

/** Events whose `{name}` is not a person, so there is no username to match. */
const ALERT_NAMELESS_EVENTS: readonly AlertEventType[] = ["ad_break", "poll_start", "poll_winner"];

// ─── Config ─────────────────────────────────────────────────────────────────

export const ALERT_MEDIA_KINDS = ["", "image", "video"] as const;
export type AlertMediaKind = (typeof ALERT_MEDIA_KINDS)[number];

export const ALERT_DURATION_MODES = ["fixed", "media"] as const;
/** fixed: `durationSeconds` on screen · media: as long as the video itself runs */
export type AlertDurationMode = (typeof ALERT_DURATION_MODES)[number];

export const ALERT_LAYOUTS = ["stacked", "row", "overlay"] as const;
/** stacked: media above text · row: media beside text · overlay: text over media */
export type AlertLayout = (typeof ALERT_LAYOUTS)[number];

export const ALERT_ANIMATIONS_IN = ALERT_ENTER_ANIMATIONS;
export type AlertAnimationIn = AlertEnterAnimation;

export const ALERT_ANIMATIONS_OUT = ALERT_EXIT_ANIMATIONS;
export type AlertAnimationOut = AlertExitAnimation;

/** Longest any one animation, text delay or early text exit can be set to. */
export const ALERT_ANIMATION_MAX_SECONDS = 10;

/**
 * The five entrances and three exits the alert box had before it took the full
 * effect list, and the effect each one is now. A saved alert still on one of
 * these is read as its nearest equivalent, at the speed it always had.
 */
const LEGACY_ANIMATIONS_IN: Record<string, AlertAnimationIn> = {
  fade: "fade_in",
  slide_up: "fade_in_up",
  slide_down: "fade_in_down",
  zoom: "zoom_in",
  bounce: "bounce_in",
};
const LEGACY_ANIMATIONS_OUT: Record<string, AlertAnimationOut> = {
  fade: "fade_out",
  slide_down: "fade_out_down",
  zoom: "zoom_out",
};

/** A saved entrance as a current one; anything unknown comes back as `fallback`. */
export function migrateAlertAnimationIn(value: unknown, fallback: AlertAnimationIn): AlertAnimationIn {
  if (typeof value !== "string") return fallback;
  if ((ALERT_ENTER_ANIMATIONS as readonly string[]).includes(value)) return value as AlertAnimationIn;
  return LEGACY_ANIMATIONS_IN[value] ?? fallback;
}

/** A saved exit as a current one; anything unknown comes back as `fallback`. */
export function migrateAlertAnimationOut(value: unknown, fallback: AlertAnimationOut): AlertAnimationOut {
  if (typeof value !== "string") return fallback;
  if ((ALERT_EXIT_ANIMATIONS as readonly string[]).includes(value)) return value as AlertAnimationOut;
  return LEGACY_ANIMATIONS_OUT[value] ?? fallback;
}

/**
 * How one alert looks, sounds and moves: media, copy, timing and look & feel.
 * The alert for an event has one, and so does each of its variations.
 */
export interface AlertPresentation {
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
  /** Seconds on screen. Ignored while `durationMode` is `media`. */
  durationSeconds: number;
  /**
   * `media` holds the alert for the video's own length instead of
   * `durationSeconds`, and falls back to it when there is no video or its
   * length never resolves.
   */
  durationMode: AlertDurationMode;

  layout: AlertLayout;

  /** How the whole alert, media and text together, comes on. */
  animationIn: AlertAnimationIn;
  /** Seconds the entrance takes. It runs inside `durationSeconds`, from 0. */
  animationInSeconds: number;
  /** How the whole alert leaves. */
  animationOut: AlertAnimationOut;
  /** Seconds the exit takes. It runs after `durationSeconds`, so it adds to the time on screen. */
  animationOutSeconds: number;

  /** The text's own entrance, on its own schedule inside the alert's. */
  textAnimationIn: AlertAnimationIn;
  textAnimationInSeconds: number;
  textAnimationOut: AlertAnimationOut;
  textAnimationOutSeconds: number;
  /** Seconds after the alert appears before its text does. */
  textDelaySeconds: number;
  /** Seconds before the alert's exit that its text leaves. */
  textEarlyExitSeconds: number;
  /** What `{name}` and `{amount}` keep doing in the title while it shows. */
  highlightAnimation: AlertHighlightAnimation;

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

/** Every key of `AlertPresentation`, for lifting one out of a larger object. */
export const ALERT_PRESENTATION_KEYS = [
  "mediaUrl",
  "mediaKind",
  "soundUrl",
  "volume",
  "titleTemplate",
  "messageTemplate",
  "durationSeconds",
  "durationMode",
  "layout",
  "animationIn",
  "animationInSeconds",
  "animationOut",
  "animationOutSeconds",
  "textAnimationIn",
  "textAnimationInSeconds",
  "textAnimationOut",
  "textAnimationOutSeconds",
  "textDelaySeconds",
  "textEarlyExitSeconds",
  "highlightAnimation",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "align",
  "titleColor",
  "messageColor",
  "accentColor",
  "textShadow",
] as const satisfies readonly (keyof AlertPresentation)[];

/** Just the presentation of an alert or variation, as its own object. */
export function alertPresentationOf(source: AlertPresentation): AlertPresentation {
  return Object.fromEntries(
    ALERT_PRESENTATION_KEYS.map((key) => [key, source[key]])
  ) as unknown as AlertPresentation;
}

// ─── Variations ─────────────────────────────────────────────────────────────

export const ALERT_VARIATION_OPERATORS = ["exact", "at_least", "session_top"] as const;
/**
 * exact: the amount equals the requirement · at_least: it is that or more ·
 * session_top: it is the biggest of its kind since the overlay loaded (and at
 * least the requirement, when one is set).
 */
export type AlertVariationOperator = (typeof ALERT_VARIATION_OPERATORS)[number];

/** Twitch's own plan ids, plus Prime, which it flags separately. */
export const ALERT_SUB_TIERS = ["prime", "1000", "2000", "3000"] as const;
export type AlertSubTier = (typeof ALERT_SUB_TIERS)[number];

/** What a variation looks at to decide whether it plays. One thing, never a mix. */
export type AlertVariationCondition =
  | { parameter: "none" }
  | { parameter: "amount"; operator: AlertVariationOperator; value: number }
  | { parameter: "tier"; tier: AlertSubTier }
  | { parameter: "name"; names: string[] };

export type AlertVariationParameter = AlertVariationCondition["parameter"];

/**
 * An alternative version of an alert that plays instead of it when its
 * condition is met: a bigger alert for a thousand bits, another one for a
 * twelve-month resub, a special one for one viewer.
 *
 * `settings` is a complete, separate copy rather than a patch over the alert.
 * Changing the alert later leaves its variations as they are -- that was
 * decided on purpose (SW-248), so a variation never changes under a streamer
 * who was not looking at it.
 */
export interface AlertVariation {
  /** Stable within its alert: what a test fires and what the editor keys on. */
  id: string;
  name: string;
  enabled: boolean;
  /** 0–100, decimals allowed. How often a matching event actually plays it. */
  chance: number;
  condition: AlertVariationCondition;
  settings: AlertPresentation;
}

export const ALERT_VARIATION_LIMITS = {
  perAlert: 20,
  nameLength: 60,
  /** Usernames in one name condition. */
  names: 50,
} as const;

/** Everything about one alert type: its presentation, its gate, its variations. */
export interface AlertVariantConfig extends AlertPresentation {
  enabled: boolean;
  /** Minimum bits / viewers / gifts / months before this alert fires. 0 = all. */
  minAmount: number;
  /** Empty on the events that take none; see `ALERT_VARIATION_EVENTS`. */
  variations: AlertVariation[];
  /** With several variations tied for an event, play a random one, not the first. */
  randomPick: boolean;
}

export interface AlertWidgetItemConfig {
  /** Quiet gap between queued alerts. */
  gapSeconds: number;
  /** Master volume 0–1, multiplied with each variant's volume. */
  masterVolume: number;
  /**
   * Hold the next alert until this one's sound file has played out, instead of
   * cutting it off. Off by default: one long sound otherwise slows every alert
   * queued behind it.
   */
  waitForSound: boolean;
  /**
   * Most alerts allowed to wait behind the one on screen; anything past it is
   * dropped. Without a ceiling a follow-bot wave parks the box for hours.
   */
  maxQueue: number;

  variants: Record<AlertEventType, AlertVariantConfig>;
}

export const DEFAULT_ALERT_VARIANT_TITLES: Record<AlertEventType, string> = {
  follow: "{name} just followed!",
  redemption: "{name} redeemed {reward}!",
  watch_streak: "{name} is on a {amount} stream watch streak!",
  modiversary: "{name} is celebrating their modiversary!",
  sub: "{name} just subscribed!",
  // {amount} is the total, not the streak: Twitch only sends a streak when the
  // viewer chooses to share it.
  resub: "{name} subscribed for {amount} months!",
  // A lone gift to one viewer. Gift bombs are `community_gift`.
  gift_sub: "{name} gifted a sub!",
  community_gift: "{name} is gifting {amount} subs to the community!",
  gift_upgrade: "{name} is continuing {gifter}'s gift sub!",
  prime_upgrade: "{name} converted their Prime sub to Tier 1!",
  pay_it_forward: "{name} is paying {gifter}'s gift sub forward!",
  cheer: "{name} cheered {amount} bits!",
  bits_badge: "{name} just earned the {amount} bits badge!",
  charity_donation: "{name} donated {amount} to {charity}!",
  hype_train_start: "{name} started a hype train!",
  hype_train_end: "Hype train ended at level {amount}!",
  raid: "{name} is raiding with {amount} viewers!",
  shoutout_received: "{name} shouted you out to {amount} viewers!",
  shoutout_sent: "Go follow {name}.",
  announcement: "{name} made an announcement",
  ad_break: "Ads for {amount} seconds. Stretch.",
  poll_start: "New poll: {name}",
  poll_winner: "{name} won the poll with {amount} votes!",
};

const DEFAULT_ALERT_VARIANT_MESSAGES: Record<AlertEventType, string> = {
  follow: "",
  redemption: "{message}",
  watch_streak: "",
  modiversary: "",
  sub: "",
  resub: "{message}",
  gift_sub: "",
  community_gift: "",
  gift_upgrade: "",
  prime_upgrade: "",
  pay_it_forward: "",
  cheer: "{message}",
  bits_badge: "",
  charity_donation: "{message}",
  hype_train_start: "",
  hype_train_end: "",
  raid: "",
  shoutout_received: "",
  shoutout_sent: "",
  announcement: "{message}",
  ad_break: "",
  poll_start: "",
  poll_winner: "",
};

export function createDefaultAlertVariantConfig(
  event: AlertEventType
): AlertVariantConfig {
  return {
    enabled: ALERT_DEFAULT_ON_EVENTS.includes(event),
    minAmount: 0,
    variations: [],
    randomPick: false,
    mediaUrl: "",
    mediaKind: "",
    soundUrl: "",
    volume: 0.8,
    titleTemplate: DEFAULT_ALERT_VARIANT_TITLES[event],
    messageTemplate: DEFAULT_ALERT_VARIANT_MESSAGES[event],
    durationSeconds: 6,
    durationMode: "fixed",
    layout: "stacked",
    // The speeds the alert box always had, back when they could not be set.
    animationIn: "zoom_in",
    animationInSeconds: 0.5,
    animationOut: "fade_out",
    animationOutSeconds: 0.35,
    textAnimationIn: "none",
    textAnimationInSeconds: 1,
    textAnimationOut: "none",
    textAnimationOutSeconds: 1,
    textDelaySeconds: 0,
    textEarlyExitSeconds: 0,
    highlightAnimation: "none",
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
    waitForSound: false,
    maxQueue: 50,
    variants: Object.fromEntries(
      ALERT_EVENT_TYPES.map((e) => [e, createDefaultAlertVariantConfig(e)])
    ) as Record<AlertEventType, AlertVariantConfig>,
  };
}

/**
 * What "Use this look for all alerts" copies: how an alert looks and moves,
 * never what it says, plays, or when it fires.
 */
export const ALERT_LOOK_KEYS = [
  "layout",
  "animationIn",
  "animationInSeconds",
  "animationOut",
  "animationOutSeconds",
  "textAnimationIn",
  "textAnimationInSeconds",
  "textAnimationOut",
  "textAnimationOutSeconds",
  "textDelaySeconds",
  "textEarlyExitSeconds",
  "highlightAnimation",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "align",
  "titleColor",
  "messageColor",
  "accentColor",
  "textShadow",
] as const satisfies readonly (keyof AlertVariantConfig)[];

/** Gives every alert the look of `from`, leaving the rest of each one alone. */
export function applyAlertLookToAll(
  cfg: AlertWidgetItemConfig,
  from: AlertEventType
): AlertWidgetItemConfig {
  const source = cfg.variants[from];
  const look = Object.fromEntries(ALERT_LOOK_KEYS.map((key) => [key, source[key]]));
  return {
    ...cfg,
    variants: Object.fromEntries(
      ALERT_EVENT_TYPES.map((event) => [event, { ...cfg.variants[event], ...look }])
    ) as Record<AlertEventType, AlertVariantConfig>,
  };
}

/** What `gift_sub` defaulted to while it also covered gift bombs. */
const LEGACY_GIFT_BOMB_TITLE = "{name} gifted {amount} subs!";

/**
 * What `resub` defaulted to. It promised a streak and printed the total, so a
 * saved title still on it moves to the new default; a rewritten one is left.
 */
const LEGACY_RESUB_TITLE = "{name} subscribed for {amount} months in a row!";

/** Hard ceiling on `maxQueue`, shared with the persisted schema. */
export const ALERT_MAX_QUEUE_LIMIT = 200;

const clamp01 = (n: unknown, fallback: number) =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.min(1, Math.max(0, n))
    : fallback;

/**
 * Seconds for an animation setting: 0 to the limit. Hundredths, not the tenths
 * the editor steps in, so the 0.35 s exit every alert always had survives.
 */
const animationSeconds = (n: unknown, fallback: number) =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.round(Math.min(ALERT_ANIMATION_MAX_SECONDS, Math.max(0, n)) * 100) / 100
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
    animationIn: migrateAlertAnimationIn(legacy.animationIn, base.animationIn),
    animationOut: migrateAlertAnimationOut(legacy.animationOut, base.animationOut),
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
      typeof r.titleTemplate === "string" &&
      r.titleTemplate.length <= 200 &&
      !(event === "resub" && r.titleTemplate === LEGACY_RESUB_TITLE)
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
    durationMode: oneOf(ALERT_DURATION_MODES, r.durationMode, base.durationMode),
    minAmount:
      typeof r.minAmount === "number" && Number.isFinite(r.minAmount)
        ? Math.max(0, Math.round(r.minAmount))
        : base.minAmount,
    layout: oneOf(ALERT_LAYOUTS, r.layout, base.layout),
    animationIn: migrateAlertAnimationIn(r.animationIn, base.animationIn),
    animationInSeconds: animationSeconds(r.animationInSeconds, base.animationInSeconds),
    animationOut: migrateAlertAnimationOut(r.animationOut, base.animationOut),
    animationOutSeconds: animationSeconds(r.animationOutSeconds, base.animationOutSeconds),
    textAnimationIn: migrateAlertAnimationIn(r.textAnimationIn, base.textAnimationIn),
    textAnimationInSeconds: animationSeconds(r.textAnimationInSeconds, base.textAnimationInSeconds),
    textAnimationOut: migrateAlertAnimationOut(r.textAnimationOut, base.textAnimationOut),
    textAnimationOutSeconds: animationSeconds(
      r.textAnimationOutSeconds,
      base.textAnimationOutSeconds
    ),
    textDelaySeconds: animationSeconds(r.textDelaySeconds, base.textDelaySeconds),
    textEarlyExitSeconds: animationSeconds(r.textEarlyExitSeconds, base.textEarlyExitSeconds),
    highlightAnimation: oneOf<AlertHighlightAnimation>(
      ALERT_HIGHLIGHT_ANIMATIONS,
      r.highlightAnimation,
      base.highlightAnimation
    ),
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
    variations: normalizeAlertVariations(r.variations, event),
    randomPick: typeof r.randomPick === "boolean" ? r.randomPick : false,
  };
}

function normalizeAlertCondition(raw: unknown, event: AlertEventType): AlertVariationCondition {
  const none: AlertVariationCondition = { parameter: "none" };
  if (!raw || typeof raw !== "object") return none;
  const r = raw as Record<string, unknown>;
  const allowed = alertVariationParameters(event);
  if (!allowed.includes(r.parameter as AlertVariationParameter)) return none;

  switch (r.parameter) {
    case "amount": {
      const operator = oneOf<AlertVariationOperator>(
        alertVariationOperators(event),
        r.operator,
        "at_least"
      );
      const value =
        typeof r.value === "number" && Number.isFinite(r.value)
          ? Math.min(1_000_000_000, Math.max(0, r.value))
          : 0;
      return { parameter: "amount", operator, value };
    }
    case "tier":
      return { parameter: "tier", tier: oneOf<AlertSubTier>(ALERT_SUB_TIERS, r.tier, "1000") };
    case "name": {
      const names = Array.isArray(r.names)
        ? [...new Set(r.names.map(normalizeAlertName).filter(Boolean))].slice(
            0,
            ALERT_VARIATION_LIMITS.names
          )
        : [];
      return { parameter: "name", names };
    }
    default:
      return none;
  }
}

function normalizeAlertVariations(raw: unknown, event: AlertEventType): AlertVariation[] {
  // An event that takes no variations keeps none, whatever was saved on it.
  if (!Array.isArray(raw) || !ALERT_VARIATION_EVENTS.includes(event)) return [];

  const seen = new Set<string>();
  return raw
    .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object")
    .slice(0, ALERT_VARIATION_LIMITS.perAlert)
    .map((v, i) => {
      // Ids only have to be unique inside their alert. A missing or repeated
      // one takes its position, so this stays the same on every read.
      let id = typeof v.id === "string" && v.id && v.id.length <= 64 ? v.id : `variation-${i + 1}`;
      if (seen.has(id)) id = `${id}-${i + 1}`;
      seen.add(id);
      const name = typeof v.name === "string" ? v.name.trim() : "";
      return {
        id,
        name: name ? name.slice(0, ALERT_VARIATION_LIMITS.nameLength) : `Variation ${i + 1}`,
        enabled: typeof v.enabled === "boolean" ? v.enabled : true,
        chance:
          typeof v.chance === "number" && Number.isFinite(v.chance)
            ? Math.min(100, Math.max(0, v.chance))
            : 100,
        condition: normalizeAlertCondition(v.condition, event),
        // The same coercion an alert gets, then only the part a variation has.
        settings: alertPresentationOf(normalizeAlertVariant(v.settings, event)),
      };
    });
}

/** Coerce persisted / partial config to a complete, safe shape. */
export function normalizeAlertWidgetConfig(
  config: OverlayItemConfig | Record<string, unknown> | null | undefined
): AlertWidgetItemConfig {
  const base = createDefaultAlertWidgetConfig();
  if (!config || typeof config !== "object") return base;
  const r = config as Partial<AlertWidgetItemConfig> & Record<string, unknown>;

  const variantsRaw = (r.variants ?? {}) as Record<string, unknown>;

  /*
   * `gift_sub` used to cover gift bombs as well: it was driven by
   * channel.subscription.gift, whose `total` is the whole bomb. Bombs are
   * their own alert now, so a saved gift_sub holds the streamer's bomb media,
   * sound and wording -- hand that to community_gift instead of dropping it,
   * and put gift_sub back on its single-gift default if it was never edited
   * off the old shared one.
   */
  const giftSubRaw = variantsRaw.gift_sub;
  const legacyGiftSub =
    giftSubRaw && typeof giftSubRaw === "object"
      ? (giftSubRaw as Record<string, unknown>)
      : null;
  const rawFor = (event: AlertEventType): unknown => {
    if (event === "community_gift") return variantsRaw.community_gift ?? giftSubRaw;
    if (
      event === "gift_sub" &&
      legacyGiftSub &&
      variantsRaw.community_gift === undefined &&
      legacyGiftSub.titleTemplate === LEGACY_GIFT_BOMB_TITLE
    ) {
      return { ...legacyGiftSub, titleTemplate: DEFAULT_ALERT_VARIANT_TITLES.gift_sub };
    }
    return variantsRaw[event];
  };

  return {
    gapSeconds:
      typeof r.gapSeconds === "number" && Number.isFinite(r.gapSeconds)
        ? Math.min(30, Math.max(0, Math.round(r.gapSeconds)))
        : base.gapSeconds,
    masterVolume: clamp01(r.masterVolume, base.masterVolume),
    waitForSound: typeof r.waitForSound === "boolean" ? r.waitForSound : base.waitForSound,
    maxQueue:
      typeof r.maxQueue === "number" && Number.isFinite(r.maxQueue)
        ? Math.min(ALERT_MAX_QUEUE_LIMIT, Math.max(1, Math.round(r.maxQueue)))
        : base.maxQueue,
    variants: Object.fromEntries(
      ALERT_EVENT_TYPES.map((e) => [
        e,
        normalizeAlertVariant(rawFor(e), e, r as Record<string, unknown>),
      ])
    ) as Record<AlertEventType, AlertVariantConfig>,
  };
}

// ─── Incoming event mapping ─────────────────────────────────────────────────

/** Normalized alert instance the renderer plays. */
export interface AlertInstance {
  event: AlertEventType;
  name: string;
  /**
   * The login behind `name`, when the payload has one. A display name can be
   * in another script entirely, so a name condition checks both.
   */
  login: string;
  /** The sub plan on a sub event; empty on everything else. */
  tier: AlertSubTier | "";
  /** bits / viewers / gifts / months / …; 0 when the event has no amount. */
  amount: number;
  /**
   * What `{amount}` prints when the raw number would read wrong -- a charity
   * donation is "$25.00", not "25". Empty means "print `amount`". Thresholds
   * still compare against `amount`, so a minimum stays a plain number.
   */
  amountText: string;
  /** Viewer-typed message (cheer / resub / announcement / …); empty otherwise. */
  message: string;
  /** The ORIGINAL gifter on a gift chain; empty when anonymous or n/a. */
  gifter: string;
  /**
   * Reward title, charity name or gift recipient — read by `{reward}`,
   * `{charity}` and `{recipient}`.
   */
  detail: string;
}

/** An anonymous gifter has no name in the payload; the alert still needs one. */
const ANONYMOUS_GIFTER = "an anonymous gifter";

function baseInstance(event: AlertEventType, name: string, login = ""): AlertInstance {
  return {
    event,
    name,
    login,
    tier: "",
    amount: 0,
    amountText: "",
    message: "",
    gifter: "",
    detail: "",
  };
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * The plan on a sub notice block. Twitch documents the field as `sub_tier` and
 * flags Prime on its own; `sub_plan` is what our fixtures have always called
 * it, so both are read.
 */
function subTier(block: Record<string, unknown> | null): AlertSubTier | "" {
  if (!block) return "";
  if (block.is_prime === true) return "prime";
  const plan = (str(block.sub_tier) || str(block.sub_plan)).toLowerCase();
  return (ALERT_SUB_TIERS as readonly string[]).includes(plan) ? (plan as AlertSubTier) : "";
}

/** Twitch sends money as minor units plus a decimal place count and a currency. */
function formatCurrency(amount: Record<string, unknown>): { value: number; text: string } {
  const places = num(amount.decimal_places);
  const value = num(amount.value) / 10 ** places;
  const currency = str(amount.currency) || "USD";
  try {
    return {
      value,
      text: new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value),
    };
  } catch {
    // Intl throws on a currency code it doesn't know. Still show the number.
    return { value, text: `${value.toFixed(places)} ${currency}` };
  }
}

/**
 * The gifter name off a pay_it_forward / gift_paid_upgrade block. Both fields
 * are nullable and anonymity is its own flag, so the fallback is not optional.
 */
function gifterName(block: Record<string, unknown> | null): string {
  if (!block) return ANONYMOUS_GIFTER;
  if (block.gifter_is_anonymous === true) return ANONYMOUS_GIFTER;
  return str(block.gifter_user_name) || ANONYMOUS_GIFTER;
}

/**
 * Map a `channel.chat.notification` payload to an alert instance.
 *
 * This subscription is the source of truth for every celebration it carries,
 * including the ones that also arrive on a dedicated subscription (sub, resub,
 * sub_gift, community_sub_gift, raid) -- those dedicated types are skipped
 * below so nothing fires twice. One notice type, one alert.
 */
function alertInstanceFromChatNotice(p: Record<string, unknown>): AlertInstance | null {
  const noticeType = str(p.notice_type);

  /*
   * During a shared chat session Twitch relays the other channel's notices
   * into this one. Firing them would celebrate someone else's subs on your
   * overlay, so both the relayed subtypes and anything flagged source-only are
   * dropped.
   */
  if (noticeType.startsWith("shared_chat_") || p.is_source_only === true) return null;

  const anonymous = p.chatter_is_anonymous === true;
  const chatter = anonymous ? "Anonymous" : str(p.chatter_user_name);
  const login = anonymous ? "" : str(p.chatter_user_login);
  const message = str((p.message as Record<string, unknown> | undefined)?.text);
  const block = (key: string) => (p[key] ?? null) as Record<string, unknown> | null;

  switch (noticeType) {
    case "sub":
      return { ...baseInstance("sub", chatter, login), tier: subTier(block("sub")) };
    case "resub": {
      const resub = block("resub");
      return {
        ...baseInstance("resub", chatter, login),
        tier: subTier(resub),
        amount: num(resub?.cumulative_months),
        message,
      };
    }
    case "sub_gift": {
      const gift = block("sub_gift");
      // Every recipient of a gift bomb gets their own sub_gift notice, tagged
      // with the bomb's id. The bomb already fires as community_sub_gift, so a
      // 100-sub bomb must not also fire 100 single-gift alerts.
      if (gift?.community_gift_id) return null;
      return {
        ...baseInstance("gift_sub", chatter, login),
        tier: subTier(gift),
        amount: num(gift?.cumulative_total),
        detail: str(gift?.recipient_user_name),
      };
    }
    case "community_sub_gift": {
      const bomb = block("community_sub_gift");
      return {
        ...baseInstance("community_gift", chatter, login),
        tier: subTier(bomb),
        amount: num(bomb?.total),
      };
    }
    case "gift_paid_upgrade":
      return {
        ...baseInstance("gift_upgrade", chatter, login),
        gifter: gifterName(block("gift_paid_upgrade")),
      };
    case "prime_paid_upgrade":
      return baseInstance("prime_upgrade", chatter, login);
    case "pay_it_forward":
      return {
        ...baseInstance("pay_it_forward", chatter, login),
        gifter: gifterName(block("pay_it_forward")),
      };
    case "raid": {
      const raid = block("raid");
      return {
        ...baseInstance("raid", str(raid?.user_name) || chatter, str(raid?.user_login) || login),
        amount: num(raid?.viewer_count),
      };
    }
    case "announcement":
      return { ...baseInstance("announcement", chatter, login), message };
    case "bits_badge_tier": {
      const badge = block("bits_badge_tier");
      return { ...baseInstance("bits_badge", chatter, login), amount: num(badge?.tier) };
    }
    case "charity_donation": {
      const donation = block("charity_donation");
      const money = formatCurrency((donation?.amount ?? {}) as Record<string, unknown>);
      return {
        ...baseInstance("charity_donation", chatter, login),
        amount: money.value,
        amountText: money.text,
        message,
        detail: str(donation?.charity_name),
      };
    }
    case "watch_streak": {
      const streak = block("watch_streak");
      // Twitch names the field consecutive_months; it counts streams watched.
      return {
        ...baseInstance("watch_streak", chatter, login),
        amount: num(streak?.consecutive_months),
      };
    }
    case "modiversary":
      // No payload object exists for this notice, so there is no year to read.
      return baseInstance("modiversary", chatter, login);
    default:
      // unraid (a cancelled raid is nothing to celebrate), unknown, and any
      // notice type Twitch adds after this was written.
      return null;
  }
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

  switch (msg.type) {
    case "channel.chat.notification":
      return alertInstanceFromChatNotice(p);

    // Subs, resubs, gifts and raids all arrive as chat notices too, with a
    // richer payload. The notice is the single source; these are dropped so
    // one celebration is one alert.
    case "channel.subscribe":
    case "channel.subscription.message":
    case "channel.subscription.gift":
    case "channel.raid":
      return null;

    case "channel.follow":
      return baseInstance("follow", str(p.user_name), str(p.user_login));

    case "channel.cheer":
      return {
        ...baseInstance(
          "cheer",
          p.is_anonymous === true ? "Anonymous" : str(p.user_name) || "Anonymous",
          p.is_anonymous === true ? "" : str(p.user_login)
        ),
        amount: num(p.bits),
        message: str(p.message),
      };

    case "channel.channel_points_custom_reward_redemption.add": {
      const reward = (p.reward ?? {}) as Record<string, unknown>;
      return {
        ...baseInstance("redemption", str(p.user_name), str(p.user_login)),
        amount: num(reward.cost),
        message: str(p.user_input),
        detail: str(reward.title),
      };
    }

    case "channel.hype_train.begin":
    case "channel.hype_train.end": {
      const top = Array.isArray(p.top_contributions)
        ? (p.top_contributions[0] as Record<string, unknown> | undefined)
        : undefined;
      return {
        ...baseInstance(
          msg.type === "channel.hype_train.begin" ? "hype_train_start" : "hype_train_end",
          // Nobody starts a train alone: credit the top contributor when there
          // is one, and the crowd that did it when there isn't.
          str(top?.user_name) || "Chat",
          str(top?.user_login)
        ),
        amount: num(p.level),
      };
    }

    case "channel.shoutout.receive":
      return {
        ...baseInstance(
          "shoutout_received",
          str(p.from_broadcaster_user_name),
          str(p.from_broadcaster_user_login)
        ),
        amount: num(p.viewer_count),
      };

    case "channel.shoutout.create":
      return {
        ...baseInstance(
          "shoutout_sent",
          str(p.to_broadcaster_user_name),
          str(p.to_broadcaster_user_login)
        ),
        amount: num(p.viewer_count),
      };

    case "channel.ad_break.begin":
      return {
        ...baseInstance("ad_break", str(p.broadcaster_user_name)),
        // Number(), not num(): this arrives as an integer, but Twitch's docs
        // described it as a string for long enough that the schema did too.
        // Parsing both costs nothing and beats an alert reading "0 seconds".
        amount: Math.round(Number(p.duration_seconds)) || 0,
      };

    case "channel.poll.begin":
      return baseInstance("poll_start", str(p.title));

    case "channel.poll.end": {
      // An archived or terminated poll has no winner worth announcing.
      if (p.status !== "completed") return null;
      const choices = Array.isArray(p.choices)
        ? (p.choices as Record<string, unknown>[])
        : [];
      const winner = choices.reduce<Record<string, unknown> | null>(
        (best, c) => (!best || num(c.votes) > num(best.votes) ? c : best),
        null
      );
      if (!winner) return null;
      return {
        ...baseInstance("poll_winner", str(winner.title)),
        amount: num(winner.votes),
      };
    }

    default:
      return null;
  }
}

/** What `{amount}` prints: the pre-formatted text when there is one. */
export function alertAmountText(alert: AlertInstance): string {
  return alert.amountText || String(alert.amount);
}

/** Every token a title or second line can use, in the order the editor offers them. */
export const ALERT_TEMPLATE_TOKENS = [
  "name",
  "amount",
  "message",
  "gifter",
  "reward",
  "charity",
  "recipient",
] as const;
export type AlertTemplateToken = (typeof ALERT_TEMPLATE_TOKENS)[number];

/**
 * The tokens an event can actually fill. `{name}` always; the rest follow the
 * per-event lists above, so the editor only offers what will print something.
 */
export function alertTokensForEvent(event: AlertEventType): ReadonlySet<AlertTemplateToken> {
  const out = new Set<AlertTemplateToken>(["name"]);
  if (ALERT_AMOUNT_LABELS[event]) out.add("amount");
  if (ALERT_MESSAGE_EVENTS.includes(event)) out.add("message");
  if (ALERT_GIFTER_EVENTS.includes(event)) out.add("gifter");
  const detail = ALERT_DETAIL_TOKENS[event];
  if (detail) out.add(detail);
  return out;
}

const TEMPLATE_TOKEN = new RegExp(`\\{(${ALERT_TEMPLATE_TOKENS.join("|")})\\}`, "g");

/**
 * Renders every template token inside a title or message template.
 *
 * One pass over the template, never over what was substituted in: a viewer who
 * types `{reward}` into their message gets it shown as typed, not swapped out.
 */
export function renderAlertTemplate(
  template: string,
  alert: AlertInstance
): string {
  return template.replace(TEMPLATE_TOKEN, (_, token: string) => {
    switch (token) {
      case "name":
        return alert.name;
      case "amount":
        return alertAmountText(alert);
      case "message":
        return alert.message;
      case "gifter":
        return alert.gifter;
      default:
        // reward / charity / recipient all read the one `detail` field.
        return alert.detail;
    }
  });
}

// ─── Variation matching ─────────────────────────────────────────────────────

/** What a variation on this event may look at. Empty = the event takes none. */
export function alertVariationParameters(event: AlertEventType): readonly AlertVariationParameter[] {
  if (!ALERT_VARIATION_EVENTS.includes(event)) return [];
  const out: AlertVariationParameter[] = ["none"];
  if (ALERT_AMOUNT_LABELS[event]) out.push("amount");
  if (ALERT_TIER_EVENTS.includes(event)) out.push("tier");
  if (!ALERT_NAMELESS_EVENTS.includes(event)) out.push("name");
  return out;
}

/** The ways an amount condition on this event can compare. */
export function alertVariationOperators(event: AlertEventType): readonly AlertVariationOperator[] {
  return ALERT_SESSION_TOP_EVENTS.includes(event)
    ? ALERT_VARIATION_OPERATORS
    : ALERT_VARIATION_OPERATORS.filter((o) => o !== "session_top");
}

/** A username as a name condition stores and compares it. */
export function normalizeAlertName(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().replace(/^@/, "").toLowerCase() : "";
}

/** Twitch's plan ids as a streamer would say them. */
export function alertTierLabel(tier: AlertSubTier): string {
  return tier === "prime" ? "Prime" : `Tier ${tier[0]}`;
}

/**
 * Whether a condition holds for an alert. `sessionTop` is the biggest amount
 * this event type has had before this one; chance and the on/off switch are
 * the picker's business, not the condition's.
 */
export function alertConditionMatches(
  alert: AlertInstance,
  condition: AlertVariationCondition,
  sessionTop: number
): boolean {
  switch (condition.parameter) {
    case "none":
      return true;
    case "amount":
      if (condition.operator === "exact") return alert.amount === condition.value;
      if (condition.operator === "at_least") return alert.amount >= condition.value;
      // A tie with the record is not a new record.
      return alert.amount > sessionTop && alert.amount >= condition.value;
    case "tier":
      return alert.tier === condition.tier;
    case "name": {
      const who = [normalizeAlertName(alert.name), normalizeAlertName(alert.login)].filter(Boolean);
      return condition.names.some((name) => who.includes(normalizeAlertName(name)));
    }
  }
}

/**
 * How specific a condition is. With several variations matching one event the
 * most specific plays: one viewer by name beats a record, a record beats an
 * exact number, an exact number beats "at least", and all of them beat a
 * variation with no condition at all.
 */
function conditionRank(condition: AlertVariationCondition): number {
  switch (condition.parameter) {
    case "name":
      return 4;
    case "amount":
      return condition.operator === "session_top" ? 3 : condition.operator === "exact" ? 2 : 1;
    case "tier":
      return 2;
    case "none":
      return 0;
  }
}

export interface AlertVariationContext {
  /** 0 ≤ n < 1, like Math.random. Handed in so a test can decide every roll. */
  random: () => number;
  /** The biggest amount this event type has had this session, before this alert. */
  sessionTop: number;
}

/**
 * The variation that plays for an alert, or null for the alert itself.
 *
 * Off variations and ones that miss their condition or their chance roll are
 * out. Of the rest the most specific kind of condition wins, then the highest
 * requirement -- a 1000-bit cheer plays "at least 1000", not "at least 100".
 * Still tied, the first in the list plays, or a random one when the alert is
 * set to pick at random (how several alerts rotate on one condition).
 */
export function pickAlertVariation(
  alert: AlertInstance,
  variant: AlertVariantConfig,
  { random, sessionTop }: AlertVariationContext
): AlertVariation | null {
  const matching = variant.variations.filter(
    (v) =>
      v.enabled &&
      alertConditionMatches(alert, v.condition, sessionTop) &&
      random() * 100 < v.chance
  );
  if (matching.length === 0) return null;

  const requirement = (v: AlertVariation) =>
    v.condition.parameter === "amount" ? v.condition.value : 0;
  const best = matching.reduce((a, b) => {
    const byRank = conditionRank(b.condition) - conditionRank(a.condition);
    if (byRank !== 0) return byRank > 0 ? b : a;
    return requirement(b) > requirement(a) ? b : a;
  });
  const tied = matching.filter(
    (v) =>
      conditionRank(v.condition) === conditionRank(best.condition) &&
      requirement(v) === requirement(best)
  );
  if (tied.length === 1 || !variant.randomPick) return tied[0]!;
  return tied[Math.min(tied.length - 1, Math.floor(random() * tied.length))]!;
}

/**
 * A variation's condition in plain words, for its row in the editor:
 * "Bits: at least 1000", "Viewer: toastcrumb, ninetoad · 25% of the time".
 */
export function alertVariationSummary(event: AlertEventType, variation: AlertVariation): string {
  const { condition, chance } = variation;
  const unit = ALERT_AMOUNT_LABELS[event] ?? "amount";
  const label = unit.charAt(0).toUpperCase() + unit.slice(1);
  const often = chance >= 100 ? "" : `${Number(chance.toFixed(2))}% of the time`;

  let when: string;
  switch (condition.parameter) {
    case "none":
      return often || "Every time";
    case "amount":
      when =
        condition.operator === "exact"
          ? `${label}: exactly ${condition.value}`
          : condition.operator === "at_least"
            ? `${label}: at least ${condition.value}`
            : condition.value > 0
              ? `${label}: biggest of the stream, at least ${condition.value}`
              : `${label}: biggest of the stream`;
      break;
    case "tier":
      when = `Sub tier: ${alertTierLabel(condition.tier)}`;
      break;
    case "name": {
      const shown = condition.names.slice(0, 3).join(", ");
      const more = condition.names.length - 3;
      when = condition.names.length === 0
        ? "Viewer: nobody yet"
        : `Viewer: ${shown}${more > 0 ? ` and ${more} more` : ""}`;
      break;
    }
  }
  return often ? `${when} · ${often}` : when;
}

/**
 * A new variation for an alert, looking like `settings` until it is edited.
 * Starts on the condition most people add one for: an amount where the event
 * has one, else its tier, else a viewer by name.
 */
export function createAlertVariation(
  event: AlertEventType,
  settings: AlertPresentation,
  id: string,
  name: string
): AlertVariation {
  const parameters = alertVariationParameters(event);
  const condition: AlertVariationCondition = parameters.includes("amount")
    ? { parameter: "amount", operator: "at_least", value: 1 }
    : parameters.includes("tier")
      ? { parameter: "tier", tier: "1000" }
      : parameters.includes("name")
        ? { parameter: "name", names: [] }
        : { parameter: "none" };
  return {
    id,
    name: name.slice(0, ALERT_VARIATION_LIMITS.nameLength),
    enabled: true,
    chance: 100,
    condition,
    settings: alertPresentationOf(settings),
  };
}

// ─── Timing ─────────────────────────────────────────────────────────────────

/** Floor for a media-matched hold, so a half-second video does not just blink. */
export const ALERT_MIN_HOLD_MS = 1000;
/** Ceiling for a media-matched hold — an hour-long file must not park the overlay. */
export const ALERT_MAX_HOLD_MS = 60_000;
/**
 * How long past a video's expected end the fallback timer waits. The video's
 * own `ended` closes the alert; this only matters when that never arrives, and
 * the slack keeps a brief buffering stall from clipping the last frames.
 */
export const ALERT_MEDIA_END_GRACE_MS = 500;

/** When each part of an alert moves, in ms since the alert appeared. */
export interface AlertTimeline {
  /** How long the alert's entrance runs; 0 = it is simply there. */
  enterMs: number;
  /** When the alert's exit starts: the end of its time on screen. */
  outAtMs: number;
  exitMs: number;
  /** When the alert is gone and the gap to the next one begins. */
  endAtMs: number;
  textInAtMs: number;
  textEnterMs: number;
  /** When the text leaves. Never before it arrived, never after the alert's own exit. */
  textOutAtMs: number;
  textExitMs: number;
}

/**
 * The schedule one alert plays to. `holdMs` is its time on screen before the
 * exit -- the set duration, or the video's length once that is known.
 *
 * The entrance runs inside the hold and the exit after it, so a 10 second
 * alert with a 1 second exit is on screen for 11. An effect set to `none`
 * takes no time whatever its seconds say: it is there, or it is gone.
 */
export function alertTimeline(p: AlertPresentation, holdMs: number): AlertTimeline {
  const ms = (effect: string, seconds: number) => (effect === "none" ? 0 : Math.max(0, seconds) * 1000);
  const outAtMs = Math.max(0, holdMs);
  const exitMs = ms(p.animationOut, p.animationOutSeconds);
  const textInAtMs = Math.min(outAtMs, Math.max(0, p.textDelaySeconds) * 1000);
  return {
    enterMs: ms(p.animationIn, p.animationInSeconds),
    outAtMs,
    exitMs,
    endAtMs: outAtMs + exitMs,
    textInAtMs,
    textEnterMs: ms(p.textAnimationIn, p.textAnimationInSeconds),
    textOutAtMs: Math.max(textInAtMs, outAtMs - Math.max(0, p.textEarlyExitSeconds) * 1000),
    textExitMs: ms(p.textAnimationOut, p.textAnimationOutSeconds),
  };
}

/** Keeps an exit time (ms since the alert started) inside the hold limits. */
export function clampAlertOutAtMs(outAtMs: number, inMs: number): number {
  return Math.min(inMs + ALERT_MAX_HOLD_MS, Math.max(inMs + ALERT_MIN_HOLD_MS, outAtMs));
}

/**
 * When a video-matched alert should leave, in ms since the alert started.
 *
 * Measured from where playback stands now, not from the alert's start: the
 * video only begins once it has loaded, so counting its length from the start
 * cut the load time off its end. Null when the length is unknown -- streamed
 * WebM often reports Infinity until it is seeked.
 */
export function alertMediaOutAtMs(
  elapsedMs: number,
  durationSeconds: number,
  currentTimeSeconds: number
): number | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  const remainingSeconds = Math.max(0, durationSeconds - currentTimeSeconds);
  return elapsedMs + remainingSeconds * 1000 + ALERT_MEDIA_END_GRACE_MS;
}

// ─── Test events ────────────────────────────────────────────────────────────

/** Why a configured variant would swallow an alert instead of playing it. */
export type AlertSkipReason = "disabled" | "below-minimum";

/**
 * The renderer's own gate, pulled out so a caller can ask the question before
 * firing a test. A test that lands on a switched-off alert looks identical to
 * a test that never arrived, so the editor needs to be able to say which.
 */
export function alertSkipReason(
  alert: AlertInstance,
  variant: AlertVariantConfig
): AlertSkipReason | null {
  if (!variant.enabled) return "disabled";
  if (variant.minAmount > 0 && alert.amount < variant.minAmount) return "below-minimum";
  return null;
}

/**
 * Maps a configurable alert category onto the event that drives it. Most are a
 * subscription type on their own; the dozen chat notices share
 * `channel.chat.notification` and pick their notice type with `variant`, the
 * same mechanism the geo demo uses for its two shapes.
 */
export const ALERT_EVENT_SUBSCRIPTION_TYPES: Record<
  AlertEventType,
  { type: WidgetTestEventType; variant?: string }
> = {
  follow: { type: "channel.follow" },
  redemption: { type: "channel.channel_points_custom_reward_redemption.add" },
  watch_streak: { type: "channel.chat.notification", variant: "watch_streak" },
  modiversary: { type: "channel.chat.notification", variant: "modiversary" },
  sub: { type: "channel.chat.notification", variant: "sub" },
  // resub is the notification fixture's default build, not a variant.
  resub: { type: "channel.chat.notification" },
  gift_sub: { type: "channel.chat.notification", variant: "sub_gift" },
  community_gift: { type: "channel.chat.notification", variant: "community_sub_gift" },
  gift_upgrade: { type: "channel.chat.notification", variant: "gift_paid_upgrade" },
  prime_upgrade: { type: "channel.chat.notification", variant: "prime_paid_upgrade" },
  pay_it_forward: { type: "channel.chat.notification", variant: "pay_it_forward" },
  cheer: { type: "channel.cheer" },
  bits_badge: { type: "channel.chat.notification", variant: "bits_badge_tier" },
  charity_donation: { type: "channel.chat.notification", variant: "charity_donation" },
  hype_train_start: { type: "channel.hype_train.begin" },
  hype_train_end: { type: "channel.hype_train.end" },
  raid: { type: "channel.chat.notification", variant: "raid" },
  shoutout_received: { type: "channel.shoutout.receive" },
  shoutout_sent: { type: "channel.shoutout.create" },
  announcement: { type: "channel.chat.notification", variant: "announcement" },
  ad_break: { type: "channel.ad_break.begin" },
  poll_start: { type: "channel.poll.begin" },
  poll_winner: { type: "channel.poll.end" },
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
  const { type, variant } = ALERT_EVENT_SUBSCRIPTION_TYPES[event];
  return buildWidgetTestEvent(type, { userName }, variant);
}

/**
 * Where a test message says "play this exact variation". It rides inside the
 * payload so one path covers a Local test (browser event) and a Live one
 * (ws-server); nothing Twitch sends ever carries the key.
 */
export const ALERT_TEST_PAYLOAD_KEY = "_test";

export interface AlertForcedVariation {
  /** The alert box the test is for; any other one plays the event as usual. */
  itemId: string;
  variationId: string;
}

/**
 * The variation a test message forces on this alert box, if it names one. The
 * editor's play button uses it to show a variation whatever its condition or
 * chance says -- the only way to look at "top cheer of the stream" on demand.
 */
export function alertForcedVariationId(payload: unknown, itemId: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const test = (payload as Record<string, unknown>)[ALERT_TEST_PAYLOAD_KEY];
  if (!test || typeof test !== "object") return null;
  const { itemId: forItem, variationId } = test as Record<string, unknown>;
  return forItem === itemId && typeof variationId === "string" && variationId ? variationId : null;
}

/** Every font an alert box can end up drawing with, variations included. */
export function alertFontFamilies(cfg: AlertWidgetItemConfig): GoogleFontFamily[] {
  return [
    ...new Set(
      ALERT_EVENT_TYPES.flatMap((event) => [
        cfg.variants[event].fontFamily,
        ...cfg.variants[event].variations.map((v) => v.settings.fontFamily),
      ]).filter(Boolean)
    ),
  ];
}

/**
 * Browser event the editor uses to fire a local-only test alert into canvas
 * previews (no server round-trip). detail: `{ sceneId, message }`.
 */
export const ALERT_TEST_BROWSER_EVENT = "streamwizard:test-alert";

export interface AlertTestBrowserEventDetail {
  sceneId: string;
  /**
   * The socket message to replay, already built. Carrying the message rather
   * than an `AlertEventType` lets the demo bar send any raw demo payload down
   * the same path -- one that isn't an alert simply maps to null.
   */
  message: { type: string; payload: Record<string, unknown> };
}
