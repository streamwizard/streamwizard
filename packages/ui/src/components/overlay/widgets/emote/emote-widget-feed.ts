import { twitchEmoteUrl } from "../../../chat/asset-urls";
import { tokenizeChatMessage } from "../../../chat/tokenize";
import type { ChatAssets, ChatFragment } from "../../../chat/types";
import {
  EMOTE_WIDGET_EVENT_TYPES,
  type EmoteWidgetBurst,
  type EmoteWidgetEvent,
  type EmoteWidgetItemConfig,
} from "./emote-widget-config";

/**
 * Frame → emote URLs. Pure, so the renderer only has to spawn and draw.
 */

export interface EmoteWidgetFrame {
  type: string;
  payload: unknown;
}

/** The channel's own Twitch emotes, code → image. Same shape the `emotes?provider=twitch` route serves. */
export type ChannelEmoteMap = Record<string, { url_2x: string; url_4x: string }>;

/**
 * A few global Twitch emotes, so a configured `Kappa` works on any channel and
 * a burst always has something to show. Ids are Twitch's own, stable for years.
 */
export const GLOBAL_TWITCH_EMOTES: Record<string, string> = {
  Kappa: "25",
  "<3": "9",
  BibleThump: "86",
  Kreygasm: "41",
  SeemsGood: "64138",
  HeyGuys: "30259",
  LUL: "425618",
  KappaPride: "55338",
};

/** The emote a burst falls back to when nothing else resolves. */
export const FALLBACK_EMOTE_URL = twitchEmoteUrl(GLOBAL_TWITCH_EMOTES.Kappa!, { big: true });

/** Resolves one code: channel emotes, then 7TV/BTTV/FFZ, then the Twitch globals. */
export function emoteUrlForCode(
  code: string,
  channel: ChannelEmoteMap,
  assets: Pick<ChatAssets, "thirdPartyEmotes">,
): string | null {
  const own = channel[code];
  if (own) return own.url_4x;
  const third = assets.thirdPartyEmotes[code];
  if (third) return third.url_4x;
  const global = GLOBAL_TWITCH_EMOTES[code];
  return global ? twitchEmoteUrl(global, { big: true }) : null;
}

// ─── Chat ───────────────────────────────────────────────────────────────────

interface ChatMessagePayload {
  chatter_user_login?: string;
  broadcaster_user_id?: string;
  message_type?: string;
  message?: { text?: string; fragments?: ChatFragment[] };
}

/** Hidden users and commands send no emotes. */
export function chatMessageAllowed(
  payload: ChatMessagePayload,
  cfg: Pick<EmoteWidgetItemConfig, "hiddenUsers" | "hideCommands">,
): boolean {
  const login = payload.chatter_user_login?.toLowerCase() ?? "";
  if (login && cfg.hiddenUsers.includes(login)) return false;
  if (cfg.hideCommands && (payload.message?.text ?? "").trimStart().startsWith("!")) return false;
  return true;
}

export interface MessageEmote {
  /** The code as typed, e.g. `Kappa`. */
  code: string;
  url: string;
}

/** Every emote in one chat message, in order, minus blocked codes. Repeats stay. */
export function chatMessageEmoteList(
  payload: ChatMessagePayload,
  assets: ChatAssets,
  blockedEmotes: readonly string[],
): MessageEmote[] {
  const fragments = payload.message?.fragments;
  if (!Array.isArray(fragments)) return [];
  const blocked = new Set(blockedEmotes);
  const out: MessageEmote[] = [];
  const tokens = tokenizeChatMessage(fragments, assets, {
    broadcasterUserId: payload.broadcaster_user_id,
    // Asks for the large image, which stays sharp at any emote size.
    gigantified: true,
  });
  for (const token of tokens) {
    if (token.kind !== "emote" || blocked.has(token.name)) continue;
    out.push({ code: token.name, url: token.url });
  }
  return out;
}

/** The emotes in one chat message, in order, minus blocked codes, capped. */
export function chatMessageEmotes(
  payload: ChatMessagePayload,
  assets: ChatAssets,
  cfg: Pick<EmoteWidgetItemConfig, "blockedEmotes" | "maxPerMessage">,
): string[] {
  return chatMessageEmoteList(payload, assets, cfg.blockedEmotes)
    .slice(0, cfg.maxPerMessage)
    .map((e) => e.url);
}

/**
 * Seconds-per-chatter gate. Mutates `lastSeen`. Returns false while the
 * chatter is still cooling down.
 */
export function cooldownAllows(
  lastSeen: Map<string, number>,
  login: string,
  now: number,
  seconds: number,
): boolean {
  if (seconds <= 0 || !login) return true;
  const last = lastSeen.get(login);
  if (last !== undefined && now - last < seconds * 1000) return false;
  lastSeen.set(login, now);
  // Keeps a busy chat from growing the map forever.
  if (lastSeen.size > 2000) {
    for (const [key, at] of lastSeen) if (now - at >= seconds * 1000) lastSeen.delete(key);
  }
  return true;
}

// ─── Events ─────────────────────────────────────────────────────────────────

export function emoteWidgetEventOf(type: string): EmoteWidgetEvent | null {
  return EMOTE_WIDGET_EVENT_TYPES[type] ?? null;
}

interface ResubMessage {
  text?: string;
  emotes?: { id?: string }[] | null;
}

/** Emotes the viewer put in their resub or cheer message. */
function eventMessageEmotes(
  payload: Record<string, unknown>,
  channel: ChannelEmoteMap,
  assets: ChatAssets,
): string[] {
  const urls: string[] = [];
  const message = payload.message;
  let text = "";
  if (typeof message === "string") {
    text = message;
  } else if (message && typeof message === "object") {
    const m = message as ResubMessage;
    text = m.text ?? "";
    for (const e of m.emotes ?? []) if (e?.id) urls.push(twitchEmoteUrl(e.id, { big: true }));
  }
  // Twitch marks its own emotes on resubs only. Cheer text, and third-party
  // codes anywhere, are matched word by word.
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const url = channel[word]?.url_4x ?? assets.thirdPartyEmotes[word]?.url_4x;
    if (url) urls.push(url);
  }
  return [...new Set(urls)];
}

/**
 * What a burst shows. The streamer's own picks win; otherwise the emotes in
 * the viewer's message, then every channel emote, then Kappa.
 */
export function burstEmoteUrls(
  burst: Pick<EmoteWidgetBurst, "emotes">,
  payload: Record<string, unknown> | null | undefined,
  channel: ChannelEmoteMap,
  assets: ChatAssets,
  blocked: readonly string[] = [],
): string[] {
  if (burst.emotes.length > 0) {
    const picked = burst.emotes
      .map((pick) => pick.url || emoteUrlForCode(pick.code, channel, assets))
      .filter((url): url is string => !!url);
    if (picked.length > 0) return picked;
  }
  if (payload) {
    const fromMessage = eventMessageEmotes(payload, channel, assets);
    if (fromMessage.length > 0) return fromMessage;
  }
  const skip = new Set(blocked);
  const own = Object.entries(channel)
    .filter(([code]) => !skip.has(code))
    .map(([, e]) => e.url_4x);
  return own.length > 0 ? own : [FALLBACK_EMOTE_URL];
}
