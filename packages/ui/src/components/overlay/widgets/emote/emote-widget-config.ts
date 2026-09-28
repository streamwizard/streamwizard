import type { OverlayItemConfig } from "../../types";
import type { ThirdPartyProvider } from "../../../chat/types";

export const EMOTE_WIDGET_TYPE = "emote_widget" as const;
export type EmoteWidgetType = typeof EMOTE_WIDGET_TYPE;

// ─── Animations ─────────────────────────────────────────────────────────────

/** How each emote moves. The engine has one small motion function per style. */
export const EMOTE_ANIMATIONS = [
  "float_up",
  "rain",
  "bounce",
  "explosion",
  "fireworks",
  "spiral",
  "zoom",
  "slide_side",
] as const;
export type EmoteAnimation = (typeof EMOTE_ANIMATIONS)[number];

export const EMOTE_ANIMATION_LABELS: Record<EmoteAnimation, string> = {
  float_up: "Float up",
  rain: "Rain",
  bounce: "Bounce",
  explosion: "Explosion",
  fireworks: "Fireworks",
  spiral: "Spiral",
  zoom: "Zoom",
  slide_side: "Slide across",
};

// ─── Events ─────────────────────────────────────────────────────────────────

/** Events that set off a burst. */
export const EMOTE_WIDGET_EVENTS = ["follow", "sub", "resub", "gift", "cheer", "raid"] as const;
export type EmoteWidgetEvent = (typeof EMOTE_WIDGET_EVENTS)[number];

export const EMOTE_WIDGET_EVENT_LABELS: Record<EmoteWidgetEvent, string> = {
  follow: "Follow",
  sub: "New sub",
  resub: "Resub",
  gift: "Gift subs",
  cheer: "Cheer",
  raid: "Raid",
};

/** EventSub type → the burst it sets off. Resubs come as their own message type. */
export const EMOTE_WIDGET_EVENT_TYPES: Record<string, EmoteWidgetEvent> = {
  "channel.follow": "follow",
  "channel.subscribe": "sub",
  "channel.subscription.message": "resub",
  "channel.subscription.gift": "gift",
  "channel.cheer": "cheer",
  "channel.raid": "raid",
};

/**
 * An emote picked in the editor. The image URL is saved with the code, so the
 * overlay never has to look it up again. Older rows saved codes only; those
 * come back with an empty `url` and resolve by code at runtime.
 */
export interface EmotePick {
  code: string;
  url: string;
}

export interface EmoteWidgetBurst {
  enabled: boolean;
  animation: EmoteAnimation;
  /** Emotes per burst. Cheers, raids and gifts scale this up (see `burstSize`). */
  count: number;
  /** Emotes to burst. Empty uses the emotes in the event's message, then the channel's own. */
  emotes: EmotePick[];
}

// ─── Config ─────────────────────────────────────────────────────────────────

export const EMOTE_WIDGET_EMOTE_PROVIDERS: readonly ThirdPartyProvider[] = ["7tv", "bttv", "ffz"];

export const EMOTE_WIDGET_LIMITS = {
  emoteSize: { min: 16, max: 256 },
  /** ms each emote stays on screen. */
  duration: { min: 1000, max: 20000 },
  maxOnScreen: { min: 10, max: 500 },
  maxPerMessage: { min: 1, max: 20 },
  userCooldown: { min: 0, max: 300 },
  burstCount: { min: 1, max: 200 },
  /** Scaled bursts never go past this, however big the cheer or raid. */
  burstMax: 300,
  emoteCodes: 30,
  emoteCodeLength: 50,
  emoteUrlLength: 500,
  hiddenUsers: 100,
  hiddenUserLength: 25,
} as const;

/** Common chat bots, hidden by default, same as the chat box. */
export const DEFAULT_EMOTE_WIDGET_HIDDEN_USERS = [
  "streamwizardbot",
  "nightbot",
  "streamelements",
  "streamlabs",
  "moobot",
  "fossabot",
  "wizebot",
  "sery_bot",
] as const;

/** Persisted JSON on `emote_widget` rows. */
export interface EmoteWidgetItemConfig {
  /** Emotes typed in chat fly across the screen. */
  chatEnabled: boolean;
  animation: EmoteAnimation;
  emoteSize: number;
  duration: number;
  maxOnScreen: number;
  maxPerMessage: number;
  /** Twitch emotes always load. These add the third-party sets. */
  emoteProviders: Record<ThirdPartyProvider, boolean>;
  hiddenUsers: string[];
  /** Messages starting with `!` send no emotes. */
  hideCommands: boolean;
  /** Emote codes that never show. */
  blockedEmotes: string[];
  /** Seconds before the same chatter can send emotes again. 0 = off. */
  userCooldown: number;
  events: Record<EmoteWidgetEvent, EmoteWidgetBurst>;
}

export const DEFAULT_EMOTE_WIDGET_BURSTS: Record<EmoteWidgetEvent, EmoteWidgetBurst> = {
  follow: { enabled: true, animation: "float_up", count: 10, emotes: [] },
  sub: { enabled: true, animation: "explosion", count: 30, emotes: [] },
  resub: { enabled: true, animation: "explosion", count: 30, emotes: [] },
  gift: { enabled: true, animation: "rain", count: 10, emotes: [] },
  cheer: { enabled: true, animation: "fireworks", count: 10, emotes: [] },
  raid: { enabled: true, animation: "rain", count: 20, emotes: [] },
};

export function createDefaultEmoteWidgetConfig(): EmoteWidgetItemConfig {
  return {
    chatEnabled: true,
    animation: "float_up",
    emoteSize: 56,
    duration: 5000,
    maxOnScreen: 150,
    maxPerMessage: 5,
    emoteProviders: { "7tv": true, bttv: true, ffz: true },
    hiddenUsers: [...DEFAULT_EMOTE_WIDGET_HIDDEN_USERS],
    hideCommands: true,
    blockedEmotes: [],
    userCooldown: 0,
    events: Object.fromEntries(
      EMOTE_WIDGET_EVENTS.map((e): [EmoteWidgetEvent, EmoteWidgetBurst] => [e, { ...DEFAULT_EMOTE_WIDGET_BURSTS[e], emotes: [] }]),
    ) as Record<EmoteWidgetEvent, EmoteWidgetBurst>,
  };
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

/** Trims, dedupes and caps emote codes. Codes are case-sensitive, like chat. */
export function normalizeEmoteCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const code = raw.trim();
    if (!code || code.length > EMOTE_WIDGET_LIMITS.emoteCodeLength || /\s/.test(code)) continue;
    seen.add(code);
    if (seen.size >= EMOTE_WIDGET_LIMITS.emoteCodes) break;
  }
  return [...seen];
}

/**
 * Cleans a list of picks: accepts old code-only strings, drops anything that
 * isn't an https image URL, dedupes by image (or by code without one) and caps the list.
 */
export function normalizeEmotePicks(value: unknown): EmotePick[] {
  if (!Array.isArray(value)) return [];
  const out = new Map<string, EmotePick>();
  for (const raw of value) {
    const code = typeof raw === "string" ? raw : (raw as Partial<EmotePick> | null)?.code;
    const url = typeof raw === "string" ? "" : (raw as Partial<EmotePick> | null)?.url;
    if (typeof code !== "string") continue;
    const clean = code.trim();
    if (!clean || clean.length > EMOTE_WIDGET_LIMITS.emoteCodeLength || /\s/.test(clean)) continue;
    const safeUrl =
      typeof url === "string" && url.length <= EMOTE_WIDGET_LIMITS.emoteUrlLength && /^https:\/\//.test(url) ? url : "";
    // Many emotes share a name (7TV has dozens of ratJAMs), so a pick is its
    // image. Code-only picks from older rows dedupe by name.
    const key = safeUrl || `code:${clean}`;
    if (!out.has(key)) out.set(key, { code: clean, url: safeUrl });
    if (out.size >= EMOTE_WIDGET_LIMITS.emoteCodes) break;
  }
  return [...out.values()];
}

/** Trims, lowercases, dedupes and caps a login list. */
export function normalizeEmoteWidgetHiddenUsers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const login = raw.trim().replace(/^@/, "").toLowerCase();
    if (!login || login.length > EMOTE_WIDGET_LIMITS.hiddenUserLength) continue;
    if (!/^[a-z0-9_]+$/.test(login)) continue;
    seen.add(login);
    if (seen.size >= EMOTE_WIDGET_LIMITS.hiddenUsers) break;
  }
  return [...seen];
}

function normalizeBurst(value: unknown, fallback: EmoteWidgetBurst): EmoteWidgetBurst {
  const r = (value && typeof value === "object" ? value : {}) as Partial<EmoteWidgetBurst>;
  return {
    enabled: bool(r.enabled, fallback.enabled),
    animation: oneOf(r.animation, EMOTE_ANIMATIONS, fallback.animation),
    count: clampInt(r.count, EMOTE_WIDGET_LIMITS.burstCount, fallback.count),
    emotes: Array.isArray(r.emotes) ? normalizeEmotePicks(r.emotes) : [...fallback.emotes],
  };
}

/** Coerce persisted / partial config to a complete, safe shape. */
export function normalizeEmoteWidgetConfig(
  config: OverlayItemConfig | Record<string, unknown> | null | undefined,
): EmoteWidgetItemConfig {
  const base = createDefaultEmoteWidgetConfig();
  if (!config || typeof config !== "object") return base;
  const r = config as Partial<EmoteWidgetItemConfig> & Record<string, unknown>;
  const providers = (r.emoteProviders ?? {}) as Partial<Record<ThirdPartyProvider, unknown>>;
  const events = (r.events ?? {}) as Partial<Record<EmoteWidgetEvent, unknown>>;

  return {
    chatEnabled: bool(r.chatEnabled, base.chatEnabled),
    animation: oneOf(r.animation, EMOTE_ANIMATIONS, base.animation),
    emoteSize: clampInt(r.emoteSize, EMOTE_WIDGET_LIMITS.emoteSize, base.emoteSize),
    duration: clampInt(r.duration, EMOTE_WIDGET_LIMITS.duration, base.duration),
    maxOnScreen: clampInt(r.maxOnScreen, EMOTE_WIDGET_LIMITS.maxOnScreen, base.maxOnScreen),
    maxPerMessage: clampInt(r.maxPerMessage, EMOTE_WIDGET_LIMITS.maxPerMessage, base.maxPerMessage),
    emoteProviders: Object.fromEntries(
      EMOTE_WIDGET_EMOTE_PROVIDERS.map((p) => [p, bool(providers[p], base.emoteProviders[p])]),
    ) as Record<ThirdPartyProvider, boolean>,
    hiddenUsers: Array.isArray(r.hiddenUsers)
      ? normalizeEmoteWidgetHiddenUsers(r.hiddenUsers)
      : base.hiddenUsers,
    hideCommands: bool(r.hideCommands, base.hideCommands),
    blockedEmotes: normalizeEmoteCodes(r.blockedEmotes),
    userCooldown: clampInt(r.userCooldown, EMOTE_WIDGET_LIMITS.userCooldown, base.userCooldown),
    events: Object.fromEntries(
      EMOTE_WIDGET_EVENTS.map((e) => [e, normalizeBurst(events[e], base.events[e])]),
    ) as Record<EmoteWidgetEvent, EmoteWidgetBurst>,
  };
}

/**
 * How many emotes a burst fires. Bigger events give bigger bursts, scaled by
 * the square root of 100-bit steps, 10-raider steps or gifted subs, so 400
 * bits doubles the burst rather than quadrupling it. Capped so a huge raid
 * can't flood the scene.
 */
export function burstSize(
  burst: Pick<EmoteWidgetBurst, "count">,
  event: EmoteWidgetEvent,
  payload: Record<string, unknown> | null | undefined,
): number {
  const num = (key: string) => {
    const v = payload?.[key];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  };
  let scale = 1;
  if (event === "cheer") scale = Math.max(1, Math.floor(num("bits") / 100));
  else if (event === "raid") scale = Math.max(1, Math.floor(num("viewers") / 10));
  else if (event === "gift") scale = Math.max(1, num("total"));
  return Math.min(EMOTE_WIDGET_LIMITS.burstMax, Math.round(burst.count * Math.sqrt(scale)));
}

/** Editor only: the settings panel's preview buttons fire this to play a burst. */
export const EMOTE_PREVIEW_EVENT = "streamwizard:emote-preview";

export interface EmotePreviewDetail {
  itemId: string;
  animation: EmoteAnimation;
  count: number;
}
