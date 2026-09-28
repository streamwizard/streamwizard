import { ASSET_TTL, getCached, setCached, singleFlight } from "./cache";
import { resolveChannelEmotes, resolveGlobalTwitchEmotes } from "./third-party-emotes";
import type { ChannelEmoteMap } from "./types";

/**
 * Every emote a streamer might want to pick in the overlay editor, grouped the
 * way they think about them: their channel, each of their 7TV sets (not just
 * the active one), BTTV channel and shared, FFZ, and each provider's globals.
 *
 * Chat rendering never uses this. It resolves codes from the merged maps in
 * third-party-emotes.ts, which only hold what works in chat right now. A
 * picked emote is saved with its image URL, so emotes from an inactive 7TV
 * set or from search work in a widget all the same.
 */

export interface LibraryEmote {
  code: string;
  url: string;
}

export interface EmoteLibrarySection {
  id: string;
  title: string;
  provider: "twitch" | "7tv" | "bttv" | "ffz";
  emotes: LibraryEmote[];
}

export type EmoteSearchProvider = "7tv" | "ffz";

const TIMEOUT_MS = 5000;
/** 7TV users can hold many sets; past this the rest are skipped. */
const MAX_7TV_SETS = 8;
const SEARCH_LIMIT = 60;

async function getJson(url: string, init?: RequestInit): Promise<unknown | undefined> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json", ...(init?.headers ?? {}) },
    });
    if (!response.ok) return undefined;
    return await response.json();
  } catch {
    return undefined;
  }
}

const sevenTvUrl = (id: string) => `https://cdn.7tv.app/emote/${id}/4x.webp`;
const bttvUrl = (id: string) => `https://cdn.betterttv.net/emote/${id}/3x`;

function ffzUrl(urls: Record<string, string> | undefined): string {
  return urls?.["4"] ?? urls?.["2"] ?? urls?.["1"] ?? "";
}

function fromMap(map: ChannelEmoteMap): LibraryEmote[] {
  return Object.values(map).map((e) => ({ code: e.name, url: e.url_4x }));
}

function byCode(emotes: LibraryEmote[]): LibraryEmote[] {
  const seen = new Set<string>();
  return emotes
    .filter((e) => e.code && e.url && !seen.has(e.code) && seen.add(e.code))
    .sort((a, b) => a.code.localeCompare(b.code));
}

// ─── 7TV ────────────────────────────────────────────────────────────────────

interface SevenTvSet {
  id: string;
  name?: string;
  emotes?: { id: string; name: string }[];
}

async function sevenTvSections(broadcasterId: string): Promise<EmoteLibrarySection[]> {
  const [userRaw, globalRaw] = await Promise.all([
    getJson(`https://7tv.io/v3/users/twitch/${broadcasterId}`),
    getJson("https://7tv.io/v3/emote-sets/global"),
  ]);
  const user = userRaw as
    | { emote_set?: SevenTvSet; user?: { emote_sets?: { id: string; name?: string }[] } }
    | undefined;
  const activeId = user?.emote_set?.id;

  // The active set comes with the user; the others need one call each.
  const others = (user?.user?.emote_sets ?? []).filter((s) => s.id !== activeId).slice(0, MAX_7TV_SETS - 1);
  const fetched = await Promise.all(
    others.map((s) => getJson(`https://7tv.io/v3/emote-sets/${s.id}`) as Promise<SevenTvSet | undefined>),
  );

  const sets: { set: SevenTvSet; active: boolean }[] = [
    ...(user?.emote_set ? [{ set: user.emote_set, active: true }] : []),
    ...fetched.filter((s): s is SevenTvSet => !!s).map((set) => ({ set, active: false })),
  ];

  const sections: EmoteLibrarySection[] = sets.map(({ set, active }) => ({
    id: `7tv:${set.id}`,
    title: `7TV · ${set.name ?? "Set"}${active ? " (in chat)" : ""}`,
    provider: "7tv" as const,
    emotes: byCode((set.emotes ?? []).map((e) => ({ code: e.name, url: sevenTvUrl(e.id) }))),
  }));
  const global = (globalRaw as SevenTvSet | undefined)?.emotes ?? [];
  sections.push({
    id: "7tv:global",
    title: "7TV · Global",
    provider: "7tv",
    emotes: byCode(global.map((e) => ({ code: e.name, url: sevenTvUrl(e.id) }))),
  });
  return sections;
}

// ─── BTTV ───────────────────────────────────────────────────────────────────

async function bttvSections(broadcasterId: string): Promise<EmoteLibrarySection[]> {
  const [channelRaw, globalRaw] = await Promise.all([
    getJson(`https://api.betterttv.net/3/cached/users/twitch/${broadcasterId}`),
    getJson("https://api.betterttv.net/3/cached/emotes/global"),
  ]);
  type Bttv = { id: string; code: string };
  const channel = channelRaw as { channelEmotes?: Bttv[]; sharedEmotes?: Bttv[] } | undefined;
  const toEmotes = (list: Bttv[] | undefined) => byCode((list ?? []).map((e) => ({ code: e.code, url: bttvUrl(e.id) })));
  return [
    { id: "bttv:channel", title: "BTTV · Channel", provider: "bttv", emotes: toEmotes(channel?.channelEmotes) },
    { id: "bttv:shared", title: "BTTV · Shared", provider: "bttv", emotes: toEmotes(channel?.sharedEmotes) },
    { id: "bttv:global", title: "BTTV · Global", provider: "bttv", emotes: toEmotes(globalRaw as Bttv[] | undefined) },
  ];
}

// ─── FFZ ────────────────────────────────────────────────────────────────────

type FfzSets = { sets?: Record<string, { title?: string; emoticons?: { name: string; urls?: Record<string, string> }[] }> };

async function ffzSections(broadcasterId: string): Promise<EmoteLibrarySection[]> {
  const [roomRaw, globalRaw] = await Promise.all([
    getJson(`https://api.frankerfacez.com/v1/room/id/${broadcasterId}`),
    getJson("https://api.frankerfacez.com/v1/set/global"),
  ]);
  const toEmotes = (raw: unknown) =>
    byCode(
      Object.values((raw as FfzSets | undefined)?.sets ?? {}).flatMap((s) =>
        (s.emoticons ?? []).map((e) => ({ code: e.name, url: ffzUrl(e.urls) })),
      ),
    );
  return [
    { id: "ffz:channel", title: "FFZ · Channel", provider: "ffz", emotes: toEmotes(roomRaw) },
    { id: "ffz:global", title: "FFZ · Global", provider: "ffz", emotes: toEmotes(globalRaw) },
  ];
}

// ─── Library ────────────────────────────────────────────────────────────────

/**
 * All sections, empty ones dropped. A provider that errors just leaves its
 * sections out rather than failing the whole picker.
 */
export async function resolveEmoteLibrary(broadcasterId: string): Promise<EmoteLibrarySection[]> {
  const key = `emotelibrary:${broadcasterId}`;
  const cached = await getCached<EmoteLibrarySection[]>(key);
  if (cached) return cached;

  return singleFlight(key, async () => {
    const settle = async <T>(p: Promise<T>, fallback: T) => {
      try {
        return await p;
      } catch {
        return fallback;
      }
    };
    const [channel, global, seventv, bttv, ffz] = await Promise.all([
      settle(resolveChannelEmotes(broadcasterId), {} as ChannelEmoteMap),
      settle(resolveGlobalTwitchEmotes(), {} as ChannelEmoteMap),
      settle(sevenTvSections(broadcasterId), [] as EmoteLibrarySection[]),
      settle(bttvSections(broadcasterId), [] as EmoteLibrarySection[]),
      settle(ffzSections(broadcasterId), [] as EmoteLibrarySection[]),
    ]);
    const all: EmoteLibrarySection[] = [
      { id: "twitch:channel", title: "Your channel", provider: "twitch", emotes: byCode(fromMap(channel)) },
      ...seventv,
      ...bttv,
      ...ffz,
      { id: "twitch:global", title: "Twitch · Global", provider: "twitch", emotes: byCode(fromMap(global)) },
    ];
    const sections = all.filter((s) => s.emotes.length > 0);
    await setCached(key, sections, ASSET_TTL.emoteLibrary);
    return sections;
  });
}

// ─── Search ─────────────────────────────────────────────────────────────────

const SEVEN_TV_SEARCH = `query Search($q: String!, $limit: Int) {
  emotes(query: $q, limit: $limit, page: 1) { items { id name } }
}`;

async function search7tv(query: string): Promise<LibraryEmote[]> {
  const raw = (await getJson("https://7tv.io/v3/gql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: SEVEN_TV_SEARCH, variables: { q: query, limit: SEARCH_LIMIT } }),
  })) as { data?: { emotes?: { items?: { id: string; name: string }[] } } } | undefined;
  return (raw?.data?.emotes?.items ?? []).map((e) => ({ code: e.name, url: sevenTvUrl(e.id) }));
}

async function searchFfz(query: string): Promise<LibraryEmote[]> {
  const params = new URLSearchParams({ q: query, sort: "count-desc", per_page: String(SEARCH_LIMIT) });
  const raw = (await getJson(`https://api.frankerfacez.com/v1/emotes?${params}`)) as
    | { emoticons?: { name: string; urls?: Record<string, string> }[] }
    | undefined;
  return (raw?.emoticons ?? []).map((e) => ({ code: e.name, url: ffzUrl(e.urls) })).filter((e) => e.url);
}

/**
 * Public emote search. Only 7TV and FFZ allow it without a login: BTTV's
 * search needs an account token, and Twitch has no emote search at all.
 * Not cached: each query is typed once and results change as emotes are added.
 */
export async function searchEmotes(provider: EmoteSearchProvider, query: string): Promise<LibraryEmote[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  return singleFlight(`emotesearch:${provider}:${q.toLowerCase()}`, () =>
    provider === "7tv" ? search7tv(q) : searchFfz(q),
  );
}

export function isEmoteSearchProvider(value: string): value is EmoteSearchProvider {
  return value === "7tv" || value === "ffz";
}
