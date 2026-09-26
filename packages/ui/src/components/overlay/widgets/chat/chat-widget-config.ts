import {
  DEFAULT_GOOGLE_FONT_FAMILY,
  resolvedTextWidgetFontFamily,
  type GoogleFontFamily,
  type OverlayItemConfig,
} from "../../types";
import type { ThirdPartyProvider } from "../../../chat/types";

// ─── Presets ────────────────────────────────────────────────────────────────

/**
 * How each line is framed. Plain is text straight on the stream, Bubbles puts
 * each message on its own rounded background, Card stacks the name above the
 * message inside a panel. Everything else in the config is a tweak on top.
 */
export const CHAT_WIDGET_PRESETS = ["plain", "bubbles", "card"] as const;
export type ChatWidgetPreset = (typeof CHAT_WIDGET_PRESETS)[number];

export const CHAT_WIDGET_PRESET_LABELS: Record<ChatWidgetPreset, string> = {
  plain: "Plain",
  bubbles: "Bubbles",
  card: "Card",
};

/**
 * Vertical is a normal chat column. Horizontal lines messages up side by side
 * on a single row, one line each, for a ticker along the top or bottom.
 */
export const CHAT_WIDGET_LAYOUTS = ["vertical", "horizontal"] as const;
export type ChatWidgetLayout = (typeof CHAT_WIDGET_LAYOUTS)[number];

/** `bottom_up` = newest at the end (bottom, or right when horizontal). */
export const CHAT_WIDGET_DIRECTIONS = ["bottom_up", "top_down"] as const;
export type ChatWidgetDirection = (typeof CHAT_WIDGET_DIRECTIONS)[number];

/** How a new message arrives. */
export const CHAT_WIDGET_ANIMATIONS_IN = ["none", "fade", "slide_up", "slide_left", "slide_right", "pop"] as const;
export type ChatWidgetAnimationIn = (typeof CHAT_WIDGET_ANIMATIONS_IN)[number];

/** How a message leaves when it fades out. */
export const CHAT_WIDGET_ANIMATIONS_OUT = ["none", "fade", "slide_left", "slide_right", "shrink"] as const;
export type ChatWidgetAnimationOut = (typeof CHAT_WIDGET_ANIMATIONS_OUT)[number];

export const CHAT_WIDGET_ANIMATION_LABELS: Record<ChatWidgetAnimationIn | ChatWidgetAnimationOut, string> = {
  none: "None",
  fade: "Fade",
  slide_up: "Slide up",
  slide_left: "Slide left",
  slide_right: "Slide right",
  pop: "Pop",
  shrink: "Shrink",
};

export const CHAT_WIDGET_NAME_COLOR_MODES = ["user", "fixed"] as const;
export type ChatWidgetNameColorMode = (typeof CHAT_WIDGET_NAME_COLOR_MODES)[number];

// ─── Notices ────────────────────────────────────────────────────────────────

/**
 * The notice groups a streamer can switch on or off. Twitch's own notice types
 * fold into these (see `chatNoticeKind`), so a new gift flavour lands under
 * Gifts without a config change.
 */
export const CHAT_WIDGET_NOTICE_KINDS = [
  "sub",
  "resub",
  "gift",
  "raid",
  "announcement",
  "other",
] as const;
export type ChatWidgetNoticeKind = (typeof CHAT_WIDGET_NOTICE_KINDS)[number];

export const CHAT_WIDGET_NOTICE_LABELS: Record<ChatWidgetNoticeKind, string> = {
  sub: "New subs",
  resub: "Resubs",
  gift: "Gift subs",
  raid: "Raids",
  announcement: "Announcements",
  other: "Everything else",
};

/**
 * Maps a `channel.chat.notification` notice_type to its toggle. Returns null
 * for notices that never belong on this channel's overlay: the `shared_chat_*`
 * relays are another channel's subs and raids during a shared chat session.
 */
export function chatNoticeKind(noticeType: string): ChatWidgetNoticeKind | null {
  if (noticeType.startsWith("shared_chat_")) return null;
  switch (noticeType) {
    case "sub":
    case "prime_paid_upgrade":
    case "gift_paid_upgrade":
      return "sub";
    case "resub":
      return "resub";
    case "sub_gift":
    case "community_sub_gift":
    case "pay_it_forward":
      return "gift";
    case "raid":
      return "raid";
    case "announcement":
      return "announcement";
    default:
      return "other";
  }
}

// ─── Config ─────────────────────────────────────────────────────────────────

export const CHAT_WIDGET_EMOTE_PROVIDERS: readonly ThirdPartyProvider[] = ["7tv", "bttv", "ffz"];

export const CHAT_WIDGET_EMOTE_PROVIDER_LABELS: Record<ThirdPartyProvider, string> = {
  "7tv": "7TV",
  bttv: "BTTV",
  ffz: "FFZ",
};

/** Common chat bots, hidden by default. Streamers can edit the list. */
export const DEFAULT_CHAT_WIDGET_HIDDEN_USERS = [
  "streamwizardbot",
  "nightbot",
  "streamelements",
  "streamlabs",
  "moobot",
  "fossabot",
  "wizebot",
  "sery_bot",
] as const;

export const CHAT_WIDGET_LIMITS = {
  fontSize: { min: 10, max: 72 },
  maxMessages: { min: 1, max: 100 },
  /** 0 keeps messages until they scroll out. */
  fadeAfterSeconds: { min: 0, max: 600 },
  gap: { min: 0, max: 48 },
  /** Inner space between the box edge and the messages. */
  padding: { min: 0, max: 64 },
  radius: { min: 0, max: 32 },
  hiddenUsers: 100,
  hiddenUserLength: 25,
} as const;

/** Persisted JSON on `chat_widget` rows. */
export interface ChatWidgetItemConfig {
  preset: ChatWidgetPreset;
  fontFamily: GoogleFontFamily;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  textColor: string;
  nameColorMode: ChatWidgetNameColorMode;
  /** Used when `nameColorMode` is `fixed`. */
  nameColor: string;
  /** Row background for Bubbles and Card. Plain ignores it. */
  backgroundColor: string;
  /** 0–1. */
  backgroundOpacity: number;
  radius: number;
  gap: number;
  /** Keeps the first and last message (and tall emotes) off the box edge. */
  padding: number;
  textShadow: boolean;
  layout: ChatWidgetLayout;
  direction: ChatWidgetDirection;
  animationIn: ChatWidgetAnimationIn;
  /** Only plays when `fadeAfterSeconds` is on; otherwise messages leave by scrolling out. */
  animationOut: ChatWidgetAnimationOut;
  /** Slides the other messages to their new spot instead of jumping. */
  animateMove: boolean;
  maxMessages: number;
  fadeAfterSeconds: number;
  showBadges: boolean;
  showAvatars: boolean;
  /** GIF messages (Tier 2/3 subs, via the Twitch GIF keyboard). Off drops them. */
  showGifs: boolean;
  notices: Record<ChatWidgetNoticeKind, boolean>;
  /** Lowercase Twitch logins whose messages never show. */
  hiddenUsers: string[];
  /** Hides messages starting with `!`. */
  hideCommands: boolean;
  emoteProviders: Record<ThirdPartyProvider, boolean>;
}

export function createDefaultChatWidgetConfig(): ChatWidgetItemConfig {
  return {
    preset: "bubbles",
    fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
    fontSize: 20,
    fontWeight: 500,
    textColor: "#ffffff",
    nameColorMode: "user",
    nameColor: "#9e7aff",
    backgroundColor: "#0b0b12",
    backgroundOpacity: 0.7,
    radius: 12,
    gap: 8,
    padding: 12,
    textShadow: true,
    layout: "vertical",
    direction: "bottom_up",
    animationIn: "slide_up",
    animationOut: "fade",
    animateMove: true,
    maxMessages: 20,
    fadeAfterSeconds: 0,
    showBadges: true,
    showAvatars: false,
    showGifs: true,
    notices: {
      sub: true,
      resub: true,
      gift: true,
      raid: true,
      announcement: true,
      other: false,
    },
    hiddenUsers: [...DEFAULT_CHAT_WIDGET_HIDDEN_USERS],
    hideCommands: true,
    emoteProviders: { "7tv": true, bttv: true, ffz: true },
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

/** Trims, lowercases, dedupes and caps a login list, dropping anything that can't be a login. */
export function normalizeChatWidgetHiddenUsers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const login = raw.trim().replace(/^@/, "").toLowerCase();
    if (!login || login.length > CHAT_WIDGET_LIMITS.hiddenUserLength) continue;
    if (!/^[a-z0-9_]+$/.test(login)) continue;
    seen.add(login);
    if (seen.size >= CHAT_WIDGET_LIMITS.hiddenUsers) break;
  }
  return [...seen];
}

/** Line height the renderer uses, as a multiple of the font size. */
export const CHAT_WIDGET_LINE_HEIGHT = 1.35;

/** Default box for the vertical layout, restored when switching back to it. */
export const CHAT_WIDGET_VERTICAL_SIZE = { w: 420, h: 600 } as const;

/** Narrowest box a horizontal strip starts at, so more than one message fits. */
export const CHAT_WIDGET_HORIZONTAL_MIN_WIDTH = 1000;

/**
 * Frame height that fits exactly one row of the horizontal layout, so the
 * strip hugs its messages instead of floating in the middle of a tall box.
 * Mirrors the renderer: line height, the preset's own padding, and the
 * widget padding on both sides. Card stacks the name over the message, so
 * it needs two lines.
 */
export function chatWidgetHorizontalHeight(
  cfg: Pick<ChatWidgetItemConfig, "fontSize" | "preset" | "padding">,
): number {
  const lines = cfg.preset === "card" ? 2 : 1;
  const presetPadding = cfg.preset === "card" ? 1 : cfg.preset === "bubbles" ? 0.6 : 0;
  // A little extra for the gap under the card's name line and for emotes,
  // which sit slightly taller than the text.
  const slack = cfg.preset === "card" ? 0.45 : 0.3;
  const em = cfg.fontSize;
  return Math.ceil(em * (lines * CHAT_WIDGET_LINE_HEIGHT + presetPadding + slack) + cfg.padding * 2);
}

/** Coerce persisted / partial config to a complete, safe shape. */
export function normalizeChatWidgetConfig(
  config: OverlayItemConfig | Record<string, unknown> | null | undefined,
): ChatWidgetItemConfig {
  const base = createDefaultChatWidgetConfig();
  if (!config || typeof config !== "object") return base;
  const r = config as Partial<ChatWidgetItemConfig> & Record<string, unknown>;

  const notices = (r.notices ?? {}) as Partial<Record<ChatWidgetNoticeKind, unknown>>;
  const providers = (r.emoteProviders ?? {}) as Partial<Record<ThirdPartyProvider, unknown>>;

  return {
    preset: oneOf(r.preset, CHAT_WIDGET_PRESETS, base.preset),
    fontFamily: resolvedTextWidgetFontFamily(r),
    fontSize: clampInt(r.fontSize, CHAT_WIDGET_LIMITS.fontSize, base.fontSize),
    fontWeight:
      r.fontWeight === 400 || r.fontWeight === 500 || r.fontWeight === 600 || r.fontWeight === 700
        ? r.fontWeight
        : base.fontWeight,
    textColor: color(r.textColor, base.textColor),
    nameColorMode: oneOf(r.nameColorMode, CHAT_WIDGET_NAME_COLOR_MODES, base.nameColorMode),
    nameColor: color(r.nameColor, base.nameColor),
    backgroundColor: color(r.backgroundColor, base.backgroundColor),
    backgroundOpacity:
      typeof r.backgroundOpacity === "number" && Number.isFinite(r.backgroundOpacity)
        ? Math.min(1, Math.max(0, r.backgroundOpacity))
        : base.backgroundOpacity,
    radius: clampInt(r.radius, CHAT_WIDGET_LIMITS.radius, base.radius),
    gap: clampInt(r.gap, CHAT_WIDGET_LIMITS.gap, base.gap),
    padding: clampInt(r.padding, CHAT_WIDGET_LIMITS.padding, base.padding),
    textShadow: bool(r.textShadow, base.textShadow),
    layout: oneOf(r.layout, CHAT_WIDGET_LAYOUTS, base.layout),
    direction: oneOf(r.direction, CHAT_WIDGET_DIRECTIONS, base.direction),
    animationIn: oneOf(r.animationIn, CHAT_WIDGET_ANIMATIONS_IN, base.animationIn),
    animationOut: oneOf(r.animationOut, CHAT_WIDGET_ANIMATIONS_OUT, base.animationOut),
    animateMove: bool(r.animateMove, base.animateMove),
    maxMessages: clampInt(r.maxMessages, CHAT_WIDGET_LIMITS.maxMessages, base.maxMessages),
    fadeAfterSeconds: clampInt(
      r.fadeAfterSeconds,
      CHAT_WIDGET_LIMITS.fadeAfterSeconds,
      base.fadeAfterSeconds,
    ),
    showBadges: bool(r.showBadges, base.showBadges),
    showAvatars: bool(r.showAvatars, base.showAvatars),
    showGifs: bool(r.showGifs, base.showGifs),
    notices: Object.fromEntries(
      CHAT_WIDGET_NOTICE_KINDS.map((kind) => [kind, bool(notices[kind], base.notices[kind])]),
    ) as Record<ChatWidgetNoticeKind, boolean>,
    hiddenUsers: Array.isArray(r.hiddenUsers)
      ? normalizeChatWidgetHiddenUsers(r.hiddenUsers)
      : base.hiddenUsers,
    hideCommands: bool(r.hideCommands, base.hideCommands),
    emoteProviders: Object.fromEntries(
      CHAT_WIDGET_EMOTE_PROVIDERS.map((p) => [p, bool(providers[p], base.emoteProviders[p])]),
    ) as Record<ThirdPartyProvider, boolean>,
  };
}
