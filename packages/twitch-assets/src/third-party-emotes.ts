import { TwitchApi } from "@repo/twitch-api";
import { ASSET_TTL, getCached, setCached, singleFlight } from "./cache";
import type { ChannelEmoteMap, ThirdPartyEmote, ThirdPartyEmoteMap, ThirdPartyProvider } from "./types";

/**
 * 7TV / BTTV / FrankerFaceZ emote maps.
 *
 * These APIs are public and unauthenticated, so unlike everything else here the
 * credential problem never applied — only the iframe CSP blocked them. We proxy
 * anyway rather than widening `connect-src`: one call per channel per hour
 * instead of one per viewer, a provider outage degrades in a single place, and
 * the allowlist doesn't grow every time an author wants a new origin.
 *
 * Each provider returns its channel emotes plus its globals, merged with
 * channel winning. A provider that errors yields an empty map rather than
 * failing the whole request — chat with missing 7TV emotes still beats no chat.
 */

const TIMEOUT_MS = 5000;

async function getJson(url: string): Promise<unknown | undefined> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    if (!response.ok) return undefined;
    return await response.json();
  } catch {
    return undefined;
  }
}

function emote(
  provider: ThirdPartyProvider,
  id: string,
  name: string,
  urls: [string, string, string]
): ThirdPartyEmote {
  return { id, name, provider, url_1x: urls[0], url_2x: urls[1], url_4x: urls[2] };
}

// ------------------------------------------------------------------- 7TV

interface SevenTvEmote {
  id: string;
  name: string;
}

function sevenTvEmotes(raw: unknown): SevenTvEmote[] {
  const set = raw as { emotes?: SevenTvEmote[]; emote_set?: { emotes?: SevenTvEmote[] } } | undefined;
  return set?.emote_set?.emotes ?? set?.emotes ?? [];
}

async function fetch7tv(broadcasterId: string): Promise<ThirdPartyEmoteMap> {
  const [globalRaw, channelRaw] = await Promise.all([
    getJson("https://7tv.io/v3/emote-sets/global"),
    getJson(`https://7tv.io/v3/users/twitch/${broadcasterId}`),
  ]);

  const map: ThirdPartyEmoteMap = {};
  for (const raw of [globalRaw, channelRaw]) {
    for (const e of sevenTvEmotes(raw)) {
      map[e.name] = emote("7tv", e.id, e.name, [
        `https://cdn.7tv.app/emote/${e.id}/1x.webp`,
        `https://cdn.7tv.app/emote/${e.id}/2x.webp`,
        `https://cdn.7tv.app/emote/${e.id}/4x.webp`,
      ]);
    }
  }
  return map;
}

// ------------------------------------------------------------------ BTTV

interface BttvEmote {
  id: string;
  code: string;
}

async function fetchBttv(broadcasterId: string): Promise<ThirdPartyEmoteMap> {
  const [globalRaw, channelRaw] = await Promise.all([
    getJson("https://api.betterttv.net/3/cached/emotes/global"),
    getJson(`https://api.betterttv.net/3/cached/users/twitch/${broadcasterId}`),
  ]);

  const channel = channelRaw as
    | { channelEmotes?: BttvEmote[]; sharedEmotes?: BttvEmote[] }
    | undefined;
  const all: BttvEmote[] = [
    ...((globalRaw as BttvEmote[] | undefined) ?? []),
    ...(channel?.channelEmotes ?? []),
    ...(channel?.sharedEmotes ?? []),
  ];

  const map: ThirdPartyEmoteMap = {};
  for (const e of all) {
    map[e.code] = emote("bttv", e.id, e.code, [
      `https://cdn.betterttv.net/emote/${e.id}/1x`,
      `https://cdn.betterttv.net/emote/${e.id}/2x`,
      `https://cdn.betterttv.net/emote/${e.id}/3x`,
    ]);
  }
  return map;
}

// ------------------------------------------------------------------- FFZ

interface FfzEmote {
  id: number;
  name: string;
  urls: Record<string, string>;
}

function ffzEmotes(raw: unknown): FfzEmote[] {
  const sets = (raw as { sets?: Record<string, { emoticons?: FfzEmote[] }> } | undefined)?.sets;
  if (!sets) return [];
  return Object.values(sets).flatMap((s) => s.emoticons ?? []);
}

async function fetchFfz(broadcasterId: string): Promise<ThirdPartyEmoteMap> {
  const [globalRaw, channelRaw] = await Promise.all([
    getJson("https://api.frankerfacez.com/v1/set/global"),
    getJson(`https://api.frankerfacez.com/v1/room/id/${broadcasterId}`),
  ]);

  const map: ThirdPartyEmoteMap = {};
  for (const raw of [globalRaw, channelRaw]) {
    for (const e of ffzEmotes(raw)) {
      // FFZ omits sizes it doesn't have, so fall back down the ladder rather
      // than emitting an undefined src.
      const one = e.urls["1"] ?? e.urls["2"] ?? e.urls["4"];
      if (!one) continue;
      map[e.name] = emote("ffz", String(e.id), e.name, [
        one,
        e.urls["2"] ?? one,
        e.urls["4"] ?? e.urls["2"] ?? one,
      ]);
    }
  }
  return map;
}

const FETCHERS: Record<ThirdPartyProvider, (broadcasterId: string) => Promise<ThirdPartyEmoteMap>> = {
  "7tv": fetch7tv,
  bttv: fetchBttv,
  ffz: fetchFfz,
};

export const THIRD_PARTY_PROVIDERS = Object.keys(FETCHERS) as ThirdPartyProvider[];

export function isThirdPartyProvider(value: string): value is ThirdPartyProvider {
  return value in FETCHERS;
}

export async function resolveThirdPartyEmotes(
  provider: ThirdPartyProvider,
  broadcasterId: string
): Promise<ThirdPartyEmoteMap> {
  const key = `tpemotes:${provider}:${broadcasterId}`;
  const cached = await getCached<ThirdPartyEmoteMap>(key);
  if (cached) return cached;

  return singleFlight(key, async () => {
    const map = await FETCHERS[provider](broadcasterId);
    await setCached(key, map, ASSET_TTL.thirdPartyEmotes);
    return map;
  });
}

// --------------------------------------------------------- channel's own

function twitchEmoteUrl(id: string, scale: "1.0" | "2.0" | "3.0"): string {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/${scale}`;
}

/**
 * The channel's own Twitch emotes (sub tiers, follower, bits). The emote
 * widget bursts these on events when the streamer hasn't picked any. Chat
 * rendering never needs this map, because EventSub already marks Twitch
 * emotes by id.
 */
export async function resolveChannelEmotes(broadcasterId: string): Promise<ChannelEmoteMap> {
  const key = `channelemotes:${broadcasterId}`;
  const cached = await getCached<ChannelEmoteMap>(key);
  if (cached) return cached;

  return singleFlight(key, async () => {
    const map = toEmoteMap(await new TwitchApi(broadcasterId).chat.getChannelEmotes());
    await setCached(key, map, ASSET_TTL.channelEmotes);
    return map;
  });
}

/** Twitch's global emotes, for the editor's emote picker. Same for every channel. */
export async function resolveGlobalTwitchEmotes(): Promise<ChannelEmoteMap> {
  const key = "globalemotes:twitch";
  const cached = await getCached<ChannelEmoteMap>(key);
  if (cached) return cached;

  return singleFlight(key, async () => {
    const map = toEmoteMap(await new TwitchApi(null).chat.getGlobalEmotes());
    await setCached(key, map, ASSET_TTL.globalEmotes);
    return map;
  });
}

function toEmoteMap(emotes: { id: string; name: string }[]): ChannelEmoteMap {
  const map: ChannelEmoteMap = {};
  for (const e of emotes) {
    map[e.name] = {
      id: e.id,
      name: e.name,
      url_1x: twitchEmoteUrl(e.id, "1.0"),
      url_2x: twitchEmoteUrl(e.id, "2.0"),
      url_4x: twitchEmoteUrl(e.id, "3.0"),
    };
  }
  return map;
}
