/**
 * Stream labels: the values behind the overlay Label widget (latest follower,
 * top cheerer, bits this stream, the event list, ...).
 *
 * Two sources, one shape:
 * - `latest`: the stream_labels row, one column per kind. The bot writes it
 *   for every event, live or offline, so "latest follower" never skips an
 *   offline follow.
 * - `session`: everything per stream (recent lists, totals, top lists),
 *   rolled up from the current stream's stream_events rows.
 *
 * Both are built and kept current by the same pure reducer,
 * `applyLabelEvent`. The server replays a stream's rows through it for the
 * snapshot; overlays run each raw event they get over ws-server through it;
 * the editor runs test events through it. One set of rules everywhere.
 */

// ─── Shapes ─────────────────────────────────────────────────────────────────

export type LabelEntryKind =
  | "follow"
  | "sub"
  | "resub"
  | "gift"
  | "cheer"
  | "raid"
  | "redemption"
  | "shoutout"
  | "hype_train";

/** One person or event, as every latest/recent/top label stores it. */
export interface LabelEntry {
  kind: LabelEntryKind;
  /** Null for anonymous gifts and cheers. */
  id?: string | null;
  login?: string | null;
  name: string;
  /** Bits, gifted subs, raid viewers, reward cost or hype train level. */
  amount?: number;
  /** Twitch tier string: "1000" | "2000" | "3000". */
  tier?: string;
  months?: number;
  message?: string;
  reward?: string;
  /** Hype train only. */
  active?: boolean;
  at: string;
}

export interface LabelLeader {
  id: string;
  login: string | null;
  name: string;
  amount: number;
}

/** The stream_labels columns, without the `latest_` prefix. */
export const LATEST_LABEL_KEYS = [
  "follower",
  "subscriber",
  "new_subscriber",
  "resubscriber",
  "gift",
  "cheer",
  "raid",
  "redemption",
  "shoutout",
  "hype_train",
] as const;

export type LatestLabelKey = (typeof LATEST_LABEL_KEYS)[number];
export type LatestLabels = Partial<Record<LatestLabelKey, LabelEntry>>;

export const LABEL_COUNT_KEYS = ["followers", "subscribers", "gifts", "bits", "raids", "redemptions", "hype_trains"] as const;
export type LabelCountKey = (typeof LABEL_COUNT_KEYS)[number];

export const LABEL_RECENT_KEYS = ["followers", "subscribers", "gifts", "cheers", "raids", "redemptions", "events"] as const;
export type LabelRecentKey = (typeof LABEL_RECENT_KEYS)[number];

export const LABEL_LEADER_KEYS = ["bits", "gifts", "redemptions"] as const;
export type LabelLeaderKey = (typeof LABEL_LEADER_KEYS)[number];

export const LABEL_TOP_KEYS = ["cheer", "raid", "hype_level"] as const;
export type LabelTopKey = (typeof LABEL_TOP_KEYS)[number];

/** One stream's labels. */
export interface SessionLabels {
  stream_id: string | null;
  /** When that stream started; the "This stream" filter counts from here. */
  started_at: string | null;
  /** Live events count toward the session; offline ones only move `latest`. */
  is_live: boolean;
  counts: Record<LabelCountKey, number>;
  /** Newest first. */
  recent: Record<LabelRecentKey, LabelEntry[]>;
  /** Highest first, uncapped (a stream's worth of people). */
  leaders: Record<LabelLeaderKey, LabelLeader[]>;
  top: Partial<Record<LabelTopKey, LabelEntry>>;
}

/** Channel totals only Helix knows. Null when the lookup failed or lacks a scope. */
export interface LabelHelixTotals {
  followers: number | null;
  subscribers: number | null;
  sub_points: number | null;
}

/**
 * The time filter on labels that have one. "stream" is the current stream (or
 * the last one while offline); the rest are calendar periods in UTC, and "all"
 * is everything since StreamWizard started tracking the channel.
 */
export const LABEL_PERIODS = ["stream", "day", "week", "month", "year", "all"] as const;
export type LabelPeriod = (typeof LABEL_PERIODS)[number];
/** Periods whose top lists come from a stream_events roll-up rather than the session. */
export type LabelCalendarPeriod = Exclude<LabelPeriod, "stream">;
export const LABEL_CALENDAR_PERIODS = ["day", "week", "month", "year", "all"] as const satisfies readonly LabelCalendarPeriod[];

export const LABEL_PERIOD_LABELS: Record<LabelPeriod, string> = {
  stream: "This stream",
  day: "Today",
  week: "This week",
  month: "This month",
  year: "This year",
  all: "All time",
};

export interface LabelSnapshot {
  broadcaster_id: string | null;
  latest: LatestLabels;
  session: SessionLabels;
  helix: LabelHelixTotals;
  /**
   * The newest logged events across all streams, newest first. The newest N
   * events of any period are exactly this list cut at the period's start, so
   * one list serves every event-list filter.
   */
  history: LabelEntry[];
  /** Top cheerers per calendar period, highest first (top 10). */
  period_leaders: Record<LabelCalendarPeriod, LabelLeader[]>;
}

export const LABEL_ANONYMOUS_NAME = "Anonymous";
export const LABEL_RECENT_CAP = 25;
export const LABEL_EVENTS_CAP = 50;

/** EventSub types that move a label. Everything else leaves the snapshot alone. */
export const LABEL_EVENT_TYPES = [
  "channel.follow",
  "channel.subscribe",
  "channel.subscription.message",
  "channel.subscription.gift",
  "channel.cheer",
  "channel.raid",
  "channel.channel_points_custom_reward_redemption.add",
  "channel.hype_train.begin",
  "channel.hype_train.progress",
  "channel.hype_train.end",
  "channel.shoutout.receive",
] as const;

export type LabelEventType = (typeof LABEL_EVENT_TYPES)[number];

export function isLabelEventType(type: string): type is LabelEventType {
  return (LABEL_EVENT_TYPES as readonly string[]).includes(type);
}

export function emptySessionLabels(streamId: string | null = null, isLive = false, startedAt: string | null = null): SessionLabels {
  return {
    stream_id: streamId,
    started_at: startedAt,
    is_live: isLive,
    counts: { followers: 0, subscribers: 0, gifts: 0, bits: 0, raids: 0, redemptions: 0, hype_trains: 0 },
    recent: { followers: [], subscribers: [], gifts: [], cheers: [], raids: [], redemptions: [], events: [] },
    leaders: { bits: [], gifts: [], redemptions: [] },
    top: {},
  };
}

export function emptyLabelSnapshot(): LabelSnapshot {
  return {
    broadcaster_id: null,
    latest: {},
    session: emptySessionLabels(),
    helix: { followers: null, subscribers: null, sub_points: null },
    history: [],
    period_leaders: emptyPeriodLeaders(),
  };
}

export function emptyPeriodLeaders(): Record<LabelCalendarPeriod, LabelLeader[]> {
  return { day: [], week: [], month: [], year: [], all: [] };
}

/**
 * When a period starts, in epoch ms (UTC calendar; weeks start on Monday).
 * Null means no lower bound ("all"). "stream" needs the session's start and is
 * null when there is no stream yet.
 */
export function labelPeriodStart(period: LabelPeriod, session: Pick<SessionLabels, "started_at">, now = Date.now()): number | null {
  const d = new Date(now);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  switch (period) {
    case "all":
      return null;
    case "stream": {
      const t = session.started_at ? Date.parse(session.started_at) : NaN;
      return Number.isFinite(t) ? t : null;
    }
    case "day":
      return Date.UTC(y, m, day);
    case "week":
      // getUTCDay: Sunday = 0. Monday-based offset.
      return Date.UTC(y, m, day - ((d.getUTCDay() + 6) % 7));
    case "month":
      return Date.UTC(y, m, 1);
    case "year":
      return Date.UTC(y, 0, 1);
  }
}

// ─── Parser ─────────────────────────────────────────────────────────────────

type Rec = Record<string, unknown>;

function rec(value: unknown): Rec | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function person(data: Rec, prefix = "user"): Pick<LabelEntry, "id" | "login" | "name"> | null {
  const id = str(data[`${prefix}_id`]);
  if (!id) return null;
  const login = str(data[`${prefix}_login`]);
  return { id, login, name: str(data[`${prefix}_name`]) ?? login ?? id };
}

function anonymousOr(data: Rec): Pick<LabelEntry, "id" | "login" | "name"> {
  if (data.is_anonymous === true) return { id: null, login: null, name: LABEL_ANONYMOUS_NAME };
  return person(data) ?? { id: null, login: null, name: LABEL_ANONYMOUS_NAME };
}

/** Drops empty fields so entries serialise cleanly (id: null is kept, it means anonymous). */
function entry(fields: LabelEntry): LabelEntry {
  const out: Rec = {};
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) out[k] = v;
  if (fields.id === null) out.id = null;
  return out as unknown as LabelEntry;
}

/** What one event means for the labels. */
export interface LabelEventEffect {
  /** stream_labels columns to overwrite. */
  latest: LatestLabels;
  /** Entry for the recent list and the event feed. */
  recent?: { key: Exclude<LabelRecentKey, "events">; item: LabelEntry };
  /** Shown in the event list without a recent list of its own. */
  feedOnly?: LabelEntry;
  counts?: Partial<Record<LabelCountKey, number>>;
  leader?: { key: LabelLeaderKey; leader: LabelLeader };
  /** Kept when it beats the current one's amount. */
  top?: { key: LabelTopKey; item: LabelEntry };
  /** Helix totals to bump (a follow or a sub landed). */
  helix?: Partial<Record<"followers" | "subscribers", number>>;
}

/**
 * One EventSub event → what it does to the labels, or null when it moves
 * nothing. `broadcasterId` filters outgoing raids; `at` defaults to now.
 *
 * Rules worth knowing (they match the credits roll-up):
 * - A gift bomb is one `channel.subscription.gift` plus one `channel.subscribe`
 *   (`is_gift: true`) per recipient. Recipients only bump the sub count and
 *   the Helix total; latest and recent show the gifter once.
 * - Anonymous gifts and cheers show as "Anonymous" and never reach a top list.
 */
export function labelEffectFromEvent(
  type: string,
  event: unknown,
  opts: { broadcasterId?: string | null; at?: string } = {},
): LabelEventEffect | null {
  const data = rec(event);
  if (!data) return null;
  const at = opts.at ?? new Date().toISOString();

  switch (type) {
    case "channel.follow": {
      const p = person(data);
      if (!p) return null;
      const e = entry({ kind: "follow", ...p, at: str(data.followed_at) ?? at });
      return { latest: { follower: e }, recent: { key: "followers", item: e }, counts: { followers: 1 }, helix: { followers: 1 } };
    }
    case "channel.subscribe": {
      if (data.is_gift === true) return { latest: {}, counts: { subscribers: 1 }, helix: { subscribers: 1 } };
      const p = person(data);
      if (!p) return null;
      const e = entry({ kind: "sub", ...p, tier: str(data.tier) ?? undefined, months: 1, at });
      return {
        latest: { subscriber: e, new_subscriber: e },
        recent: { key: "subscribers", item: e },
        counts: { subscribers: 1 },
        helix: { subscribers: 1 },
      };
    }
    case "channel.subscription.message": {
      const p = person(data);
      if (!p) return null;
      const e = entry({
        kind: "resub",
        ...p,
        tier: str(data.tier) ?? undefined,
        months: num(data.cumulative_months) ?? undefined,
        message: str(rec(data.message)?.text) ?? undefined,
        at,
      });
      return { latest: { subscriber: e, resubscriber: e }, recent: { key: "subscribers", item: e }, counts: { subscribers: 1 } };
    }
    case "channel.subscription.gift": {
      const total = num(data.total) ?? 1;
      const p = anonymousOr(data);
      const e = entry({ kind: "gift", ...p, tier: str(data.tier) ?? undefined, amount: total, at });
      return {
        latest: { gift: e },
        recent: { key: "gifts", item: e },
        counts: { gifts: total },
        leader: p.id ? { key: "gifts", leader: { id: p.id, login: p.login ?? null, name: p.name, amount: total } } : undefined,
      };
    }
    case "channel.cheer": {
      const bits = num(data.bits) ?? 0;
      if (bits <= 0) return null;
      const p = anonymousOr(data);
      const e = entry({ kind: "cheer", ...p, amount: bits, message: str(data.message) ?? undefined, at });
      return {
        latest: { cheer: e },
        recent: { key: "cheers", item: e },
        counts: { bits },
        top: { key: "cheer", item: e },
        leader: p.id ? { key: "bits", leader: { id: p.id, login: p.login ?? null, name: p.name, amount: bits } } : undefined,
      };
    }
    case "channel.raid": {
      if (opts.broadcasterId && str(data.to_broadcaster_user_id) !== opts.broadcasterId) return null;
      const p = person(data, "from_broadcaster_user");
      if (!p) return null;
      const e = entry({ kind: "raid", ...p, amount: num(data.viewers) ?? 0, at });
      return { latest: { raid: e }, recent: { key: "raids", item: e }, counts: { raids: 1 }, top: { key: "raid", item: e } };
    }
    case "channel.channel_points_custom_reward_redemption.add": {
      const p = person(data);
      if (!p) return null;
      const reward = rec(data.reward);
      const e = entry({
        kind: "redemption",
        ...p,
        reward: str(reward?.title) ?? undefined,
        amount: num(reward?.cost) ?? undefined,
        message: str(data.user_input) ?? undefined,
        at: str(data.redeemed_at) ?? at,
      });
      return {
        latest: { redemption: e },
        recent: { key: "redemptions", item: e },
        counts: { redemptions: 1 },
        leader: { key: "redemptions", leader: { id: p.id!, login: p.login ?? null, name: p.name, amount: 1 } },
      };
    }
    case "channel.hype_train.begin":
    case "channel.hype_train.progress":
    case "channel.hype_train.end": {
      const e = entry({
        kind: "hype_train",
        name: "Hype train",
        amount: num(data.level) ?? 1,
        active: type !== "channel.hype_train.end",
        at,
      });
      return {
        latest: { hype_train: e },
        counts: type === "channel.hype_train.begin" ? { hype_trains: 1 } : undefined,
        top: { key: "hype_level", item: e },
        feedOnly: type === "channel.hype_train.end" ? e : undefined,
      };
    }
    case "channel.shoutout.receive": {
      const p = person(data, "from_broadcaster_user");
      if (!p) return null;
      const e = entry({ kind: "shoutout", ...p, amount: num(data.viewer_count) ?? undefined, at });
      return { latest: { shoutout: e }, feedOnly: e };
    }
    default:
      return null;
  }
}

/** The stream_labels columns an event writes, keyed by column name. Null when it writes none. */
export function latestLabelColumns(type: string, event: unknown, broadcasterId?: string | null): Record<string, LabelEntry> | null {
  const effect = labelEffectFromEvent(type, event, { broadcasterId });
  if (!effect) return null;
  const cols: Record<string, LabelEntry> = {};
  for (const [k, v] of Object.entries(effect.latest)) if (v) cols[`latest_${k}`] = v;
  return Object.keys(cols).length ? cols : null;
}

/** A stream_labels row → the `latest` part of a snapshot. */
export function latestLabelsFromRow(row: Record<string, unknown> | null | undefined): LatestLabels {
  const out: LatestLabels = {};
  if (!row) return out;
  for (const key of LATEST_LABEL_KEYS) {
    const v = rec(row[`latest_${key}`]);
    if (v && typeof v.name === "string") out[key] = v as unknown as LabelEntry;
  }
  return out;
}

// ─── Reducer ────────────────────────────────────────────────────────────────

function addLeader(list: LabelLeader[], l: LabelLeader): LabelLeader[] {
  const next = [...list];
  const idx = next.findIndex((x) => x.id === l.id);
  if (idx >= 0) next[idx] = { ...next[idx]!, login: l.login, name: l.name, amount: next[idx]!.amount + l.amount };
  else next.push({ ...l });
  // Stable: ties keep whoever got there first.
  return next.sort((a, b) => b.amount - a.amount);
}

/**
 * Applies one event. `session` only moves while `session.is_live` (the server
 * builds it from the live stream's rows, so an offline event would be gone on
 * the next read anyway); `latest` and Helix totals always move. Returns the
 * same object when nothing changed.
 */
export function applyLabelEvent(
  snapshot: LabelSnapshot,
  type: string,
  event: unknown,
  opts: { at?: string; forceSession?: boolean } = {},
): LabelSnapshot {
  const effect = labelEffectFromEvent(type, event, { broadcasterId: snapshot.broadcaster_id, at: opts.at });
  if (!effect) return snapshot;
  return applyLabelEffect(snapshot, effect, opts.forceSession);
}

export function applyLabelEffect(snapshot: LabelSnapshot, effect: LabelEventEffect, forceSession = false): LabelSnapshot {
  const latest = Object.keys(effect.latest).length ? { ...snapshot.latest, ...effect.latest } : snapshot.latest;

  let helix = snapshot.helix;
  if (effect.helix) {
    helix = { ...helix };
    for (const [k, by] of Object.entries(effect.helix) as ["followers" | "subscribers", number][]) {
      if (helix[k] !== null) helix[k] = helix[k]! + by;
    }
  }

  let session = snapshot.session;
  if (session.is_live || forceSession) {
    const s: SessionLabels = { ...session, counts: { ...session.counts }, recent: { ...session.recent }, leaders: { ...session.leaders }, top: { ...session.top } };
    for (const [k, by] of Object.entries(effect.counts ?? {}) as [LabelCountKey, number][]) s.counts[k] += by;
    const feed = effect.recent?.item ?? effect.feedOnly;
    if (effect.recent) s.recent[effect.recent.key] = [effect.recent.item, ...s.recent[effect.recent.key]].slice(0, LABEL_RECENT_CAP);
    if (feed) s.recent.events = [feed, ...s.recent.events].slice(0, LABEL_EVENTS_CAP);
    if (effect.leader) s.leaders[effect.leader.key] = addLeader(s.leaders[effect.leader.key], effect.leader.leader);
    if (effect.top) {
      const cur = s.top[effect.top.key];
      if (!cur || (effect.top.item.amount ?? 0) > (cur.amount ?? 0)) s.top[effect.top.key] = effect.top.item;
    }
    session = s;
  }

  // History and the calendar top lists come from stream_events, which only
  // logs while live, so they move under the same rule as the session.
  let history = snapshot.history;
  let periodLeaders = snapshot.period_leaders;
  if (snapshot.session.is_live || forceSession) {
    const feed = effect.recent?.item ?? effect.feedOnly;
    if (feed) history = [feed, ...history].slice(0, LABEL_EVENTS_CAP);
    const leader = effect.leader;
    if (leader?.key === "bits") {
      periodLeaders = { ...periodLeaders };
      for (const p of LABEL_CALENDAR_PERIODS) periodLeaders[p] = addLeader(periodLeaders[p], leader.leader).slice(0, 10);
    }
  }

  return { ...snapshot, latest, helix, session, history, period_leaders: periodLeaders };
}

/** One stored stream_events row, as much as the roll-up reads. */
export interface LabelEventRow {
  event_type: string;
  event_data: unknown;
  created_at: string;
}

/** Replays a stream's rows (created_at ascending) into its session labels. */
export function buildSessionLabels(
  rows: readonly LabelEventRow[],
  meta: { stream_id: string | null; is_live: boolean; broadcaster_id: string; started_at?: string | null },
): SessionLabels {
  let snap: LabelSnapshot = {
    ...emptyLabelSnapshot(),
    broadcaster_id: meta.broadcaster_id,
    session: emptySessionLabels(meta.stream_id, meta.is_live, meta.started_at ?? null),
  };
  for (const row of rows) {
    const effect = labelEffectFromEvent(row.event_type, row.event_data, { broadcasterId: meta.broadcaster_id, at: row.created_at });
    if (effect) snap = applyLabelEffect(snap, effect, true);
  }
  return snap.session;
}

/**
 * The event-list history from rows newest first. Rows that don't show in the
 * list (gift recipients, hype train progress) are skipped, so callers should
 * fetch a little more than LABEL_EVENTS_CAP.
 */
export function buildLabelHistory(rowsNewestFirst: readonly LabelEventRow[], broadcasterId: string): LabelEntry[] {
  const out: LabelEntry[] = [];
  for (const row of rowsNewestFirst) {
    const effect = labelEffectFromEvent(row.event_type, row.event_data, { broadcasterId, at: row.created_at });
    const feed = effect?.recent?.item ?? effect?.feedOnly;
    if (feed) out.push(feed);
    if (out.length >= LABEL_EVENTS_CAP) break;
  }
  return out;
}

// ─── Catalog ────────────────────────────────────────────────────────────────

export type LabelGroup = "followers" | "subscribers" | "bits" | "raids" | "channel_points" | "hype_train" | "channel";

export const LABEL_GROUP_TITLES: Record<LabelGroup, string> = {
  followers: "Followers",
  subscribers: "Subscribers",
  bits: "Bits",
  raids: "Raids",
  channel_points: "Channel points",
  hype_train: "Hype train",
  channel: "Channel",
};

/**
 * How a label resolves:
 * - `entry`: one LabelEntry (latest follower, top cheer)
 * - `number`: a count or total
 * - `list`: LabelEntry[] newest first (recent followers, event list)
 * - `leaders`: LabelLeader[] highest first; `single` labels show only the first
 */
export type LabelShape = "entry" | "number" | "list" | "leaders";

export type LabelSource =
  | { from: "latest"; key: LatestLabelKey }
  | { from: "helix"; key: keyof LabelHelixTotals }
  | { from: "count"; key: LabelCountKey }
  | { from: "recent"; key: LabelRecentKey }
  | { from: "leaders"; key: LabelLeaderKey }
  | { from: "top"; key: LabelTopKey };

export interface LabelDefinition {
  id: string;
  group: LabelGroup;
  title: string;
  shape: LabelShape;
  source: LabelSource;
  /** Leaderboard labels that show only the top entry. */
  single?: boolean;
  /** Offers the time filter, starting on this period. Counts from Twitch have none. */
  defaultPeriod?: LabelPeriod;
  /** Default text. Tokens: {name} {amount} {tier} {months} {message} {reward} {event}. */
  template: string;
}

const latest = (key: LatestLabelKey): LabelSource => ({ from: "latest", key });
const helix = (key: keyof LabelHelixTotals): LabelSource => ({ from: "helix", key });
const count = (key: LabelCountKey): LabelSource => ({ from: "count", key });
const recent = (key: LabelRecentKey): LabelSource => ({ from: "recent", key });
const leaders = (key: LabelLeaderKey): LabelSource => ({ from: "leaders", key });
const top = (key: LabelTopKey): LabelSource => ({ from: "top", key });

/**
 * What the Label widget's picker offers. Deliberately short: the basics
 * streamers ask for first. The snapshot already carries more (recent lists,
 * per-stream counts, top gifters and redeemers, biggest raid, hype trains),
 * so adding one of those is a single line here with a `source` below.
 */
export const LABEL_CATALOG: readonly LabelDefinition[] = [
  { id: "latest_follower", group: "followers", title: "Latest follower", shape: "entry", source: latest("follower"), defaultPeriod: "all", template: "{name}" },
  { id: "follower_count", group: "followers", title: "Follower count", shape: "number", source: helix("followers"), template: "{amount}" },
  { id: "latest_subscriber", group: "subscribers", title: "Latest subscriber", shape: "entry", source: latest("subscriber"), defaultPeriod: "all", template: "{name}" },
  { id: "latest_gift", group: "subscribers", title: "Latest gift", shape: "entry", source: latest("gift"), defaultPeriod: "all", template: "{name} gifted {amount}" },
  { id: "subscriber_count", group: "subscribers", title: "Subscriber count", shape: "number", source: helix("subscribers"), template: "{amount}" },
  { id: "latest_cheer", group: "bits", title: "Latest cheer", shape: "entry", source: latest("cheer"), defaultPeriod: "all", template: "{name} - {amount}" },
  { id: "top_cheerer", group: "bits", title: "Top cheerer", shape: "leaders", source: leaders("bits"), single: true, defaultPeriod: "stream", template: "{name} - {amount}" },
  { id: "latest_raid", group: "raids", title: "Latest raid", shape: "entry", source: latest("raid"), defaultPeriod: "all", template: "{name} ({amount})" },
  { id: "event_list", group: "channel", title: "Event list", shape: "list", source: recent("events"), defaultPeriod: "stream", template: "{event}" },
];

export const DEFAULT_LABEL_ID = "latest_follower";

export function getLabelDefinition(id: string): LabelDefinition {
  return LABEL_CATALOG.find((d) => d.id === id) ?? LABEL_CATALOG[0]!;
}

export type ResolvedLabel =
  | { shape: "entry"; entry: LabelEntry | null }
  | { shape: "number"; value: number | null }
  | { shape: "list"; items: LabelEntry[] }
  | { shape: "leaders"; items: LabelLeader[] };

function since(at: string | undefined, start: number | null): boolean {
  if (start === null) return true;
  const t = at ? Date.parse(at) : NaN;
  return Number.isFinite(t) && t >= start;
}

/**
 * Reads one label out of a snapshot. `period` applies to labels with a time
 * filter (see `defaultPeriod`) and is ignored by the rest.
 *
 * - Latest labels show their entry only if it happened inside the period, so
 *   "Latest follower this week" goes empty on Monday until someone follows.
 * - The event list cuts `history` at the period's start ("This stream" reads
 *   the session so the editor's sample data shows).
 * - Top cheerer reads the session for "This stream", the stream_events
 *   roll-up for the rest.
 */
export function resolveLabel(
  snapshot: LabelSnapshot,
  def: LabelDefinition,
  period: LabelPeriod = def.defaultPeriod ?? "stream",
  now = Date.now(),
): ResolvedLabel {
  const src = def.source;
  const p = def.defaultPeriod ? period : "all";
  const start = labelPeriodStart(p, snapshot.session, now);
  // "This stream" with no stream yet has nothing to show.
  const noStream = p === "stream" && start === null;
  switch (src.from) {
    case "latest": {
      const e = snapshot.latest[src.key] ?? null;
      return { shape: "entry", entry: e && !noStream && since(e.at, start) ? e : null };
    }
    case "top":
      return { shape: "entry", entry: snapshot.session.top[src.key] ?? null };
    case "helix":
      return { shape: "number", value: snapshot.helix[src.key] ?? null };
    case "count":
      return { shape: "number", value: snapshot.session.counts[src.key] ?? 0 };
    case "recent": {
      if (src.key !== "events" || p === "stream") return { shape: "list", items: snapshot.session.recent[src.key] ?? [] };
      return { shape: "list", items: snapshot.history.filter((e) => since(e.at, start)) };
    }
    case "leaders": {
      const items =
        p === "stream" || src.key !== "bits" ? (snapshot.session.leaders[src.key] ?? []) : (snapshot.period_leaders[p] ?? []);
      return { shape: "leaders", items: def.single ? items.slice(0, 1) : items };
    }
  }
}

// ─── Formatting ─────────────────────────────────────────────────────────────

const TIER_NAMES: Record<string, string> = { "1000": "Tier 1", "2000": "Tier 2", "3000": "Tier 3" };

/** A one-line description of an event for the event list. */
export function describeLabelEntry(e: LabelEntry): string {
  switch (e.kind) {
    case "follow":
      return `${e.name} followed`;
    case "sub":
      return `${e.name} subscribed`;
    case "resub":
      return e.months ? `${e.name} resubscribed (${e.months} months)` : `${e.name} resubscribed`;
    case "gift":
      return `${e.name} gifted ${e.amount ?? 1} ${e.amount === 1 ? "sub" : "subs"}`;
    case "cheer":
      return `${e.name} cheered ${e.amount ?? 0} bits`;
    case "raid":
      return `${e.name} raided with ${e.amount ?? 0}`;
    case "redemption":
      return e.reward ? `${e.name} redeemed ${e.reward}` : `${e.name} redeemed a reward`;
    case "shoutout":
      return `Shoutout from ${e.name}`;
    case "hype_train":
      return `Hype train level ${e.amount ?? 1}`;
    default:
      return e.name;
  }
}

export interface LabelTemplateValues {
  name?: string;
  amount?: number | null;
  tier?: string;
  months?: number;
  message?: string;
  reward?: string;
  event?: string;
}

export function labelTemplateValues(item: LabelEntry | LabelLeader): LabelTemplateValues {
  if ("kind" in item) {
    return {
      name: item.name,
      amount: item.amount ?? null,
      tier: item.tier ? (TIER_NAMES[item.tier] ?? item.tier) : undefined,
      months: item.months,
      message: item.message,
      reward: item.reward,
      event: describeLabelEntry(item),
    };
  }
  return { name: item.name, amount: item.amount };
}

/** Fills `{token}`s. Unknown or empty tokens become "", numbers get thousands separators. */
export function formatLabelTemplate(template: string, values: LabelTemplateValues, locale?: string): string {
  return template
    .replace(/\{(\w+)\}/g, (_, token: string) => {
      const v = values[token as keyof LabelTemplateValues];
      if (v === undefined || v === null) return "";
      if (typeof v === "number") return v.toLocaleString(locale);
      return String(v);
    })
    .replace(/\s+\(\s*\)/g, "")
    .trim();
}

// ─── Demo data ──────────────────────────────────────────────────────────────

/** Sample labels for the editor while the channel has none yet. */
export function buildDemoLabelSnapshot(now = Date.now()): LabelSnapshot {
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
  const rows: LabelEventRow[] = [
    { event_type: "channel.shoutout.receive", event_data: { from_broadcaster_user_id: "d9", from_broadcaster_user_login: "bigstreamer", from_broadcaster_user_name: "BigStreamer", viewer_count: 1200 }, created_at: at(40) },
    { event_type: "channel.raid", event_data: { from_broadcaster_user_id: "d8", from_broadcaster_user_login: "cozycorner", from_broadcaster_user_name: "CozyCorner", viewers: 42 }, created_at: at(30) },
    { event_type: "channel.hype_train.begin", event_data: { level: 1 }, created_at: at(27) },
    { event_type: "channel.hype_train.end", event_data: { level: 3 }, created_at: at(25) },
    { event_type: "channel.follow", event_data: { user_id: "d3", user_login: "ninetoad", user_name: "NineToad" }, created_at: at(21) },
    { event_type: "channel.cheer", event_data: { user_id: "d3", user_login: "ninetoad", user_name: "NineToad", bits: 800 }, created_at: at(20) },
    { event_type: "channel.subscription.gift", event_data: { user_id: "d6", user_login: "cheesewheel", user_name: "CheeseWheel", total: 5, tier: "1000" }, created_at: at(17) },
    { event_type: "channel.subscription.message", event_data: { user_id: "d5", user_login: "grumpycatto", user_name: "GrumpyCatto", tier: "1000", cumulative_months: 14 }, created_at: at(12) },
    { event_type: "channel.follow", event_data: { user_id: "d2", user_login: "byteme", user_name: "ByteMe" }, created_at: at(9) },
    { event_type: "channel.cheer", event_data: { user_id: "d7", user_login: "moonpie", user_name: "MoonPie", bits: 500, message: "Cheer500 gg" }, created_at: at(7) },
    { event_type: "channel.subscribe", event_data: { user_id: "d4", user_login: "sandwichlord", user_name: "SandwichLord", tier: "1000" }, created_at: at(5) },
    { event_type: "channel.channel_points_custom_reward_redemption.add", event_data: { user_id: "d2", user_login: "byteme", user_name: "ByteMe", reward: { title: "Hydrate", cost: 500 } }, created_at: at(4) },
    { event_type: "channel.follow", event_data: { user_id: "d1", user_login: "pixelpenny", user_name: "PixelPenny" }, created_at: at(2) },
  ];
  let snap: LabelSnapshot = {
    ...emptyLabelSnapshot(),
    broadcaster_id: null,
    session: emptySessionLabels("demo", true, at(45)),
    helix: { followers: 1284, subscribers: 57, sub_points: 63 },
  };
  for (const row of rows) snap = applyLabelEvent(snap, row.event_type, row.event_data, { at: row.created_at });
  // The sample stream is the whole sample history, so every filter shows it.
  // Helix numbers are sample values; the replay bumped them, so set them back.
  return { ...snap, helix: { followers: 1284, subscribers: 57, sub_points: 63 } };
}
