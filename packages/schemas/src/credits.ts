import { z } from "zod";
import { WIDGET_TEST_EVENTS } from "./widget-test-events";

/**
 * End-of-stream credits: who followed, subbed, gifted, cheered and raided
 * during one stream, rolled up from the `stream_events` rows StreamWizard
 * wrote while the channel was live.
 *
 * Everything here is pure. The database read lives in
 * `@repo/supabase/queries/credits`, the orchestration (stream selection,
 * avatars) in `@repo/twitch-assets`, and the widget only ever sees
 * `CreditsData`. Keeping the roll-up in one testable function is what lets the
 * editor's sample data go through the exact same code as a real stream.
 */

/** The `stream_events.event_type` values credits read. Everything else is skipped. */
export const CREDITS_EVENT_TYPES = [
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
  "stream.offline",
] as const;

export type CreditsEventType = (typeof CREDITS_EVENT_TYPES)[number];

/** The name shown for anonymous gifts and cheers. */
export const CREDITS_ANONYMOUS_NAME = "Anonymous";

export const creditsPersonSchema = z.object({
  /** Null for the one "Anonymous" bucket per section. */
  user_id: z.string().nullable(),
  login: z.string().nullable(),
  name: z.string(),
  /** Bits, gifted subs, raid viewers, months or redemptions, depending on the section. */
  value: z.number().optional(),
  profile_image_url: z.string().optional(),
});

export type CreditsPerson = z.infer<typeof creditsPersonSchema>;

export const creditsCountsSchema = z.object({
  followers: z.number().int(),
  subs: z.number().int(),
  resubs: z.number().int(),
  /** Subs given away, summed from the gift events (never the recipients' rows). */
  gift_subs: z.number().int(),
  bits: z.number().int(),
  raids: z.number().int(),
  redemptions: z.number().int(),
  hype_trains: z.number().int(),
});

export type CreditsCounts = z.infer<typeof creditsCountsSchema>;

export const creditsDataSchema = z.object({
  stream_id: z.string().nullable(),
  is_live: z.boolean(),
  started_at: z.string().nullable(),
  /** From the stream.offline row. Null while live, or when that row never landed. */
  ended_at: z.string().nullable(),
  duration_seconds: z.number().int().nullable(),
  peak_viewers: z.number().int().nullable(),
  followers: z.array(creditsPersonSchema),
  subs: z.array(creditsPersonSchema),
  resubs: z.array(creditsPersonSchema),
  gifters: z.array(creditsPersonSchema),
  cheerers: z.array(creditsPersonSchema),
  raids: z.array(creditsPersonSchema),
  redeemers: z.array(creditsPersonSchema),
  hype_train: z
    .object({ count: z.number().int(), top_level: z.number().int(), top_total: z.number().int() })
    .nullable(),
  counts: creditsCountsSchema,
  missing: z.object({
    /** No stream to read at all: the channel never went live with StreamWizard watching. */
    stream: z.boolean(),
    /** A stream, but not one saved event. */
    events: z.boolean(),
    /** No viewer samples, so no peak. */
    viewers: z.boolean(),
  }),
  generated_at: z.string(),
});

export type CreditsData = z.infer<typeof creditsDataSchema>;

/** One `stream_events` row, as much of it as the roll-up reads. */
export interface CreditsEventRow {
  event_type: string;
  event_data: unknown;
  created_at: string;
  offset_seconds: number;
}

export interface CreditsStreamMeta {
  stream_id: string;
  broadcaster_id: string;
  is_live: boolean;
  started_at: string | null;
  peak_viewers: number | null;
  /** Injected in tests; defaults to Date.now(). */
  now?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

type Rec = Record<string, unknown>;

function rec(value: unknown): Rec | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function int(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

/** The person an event is about, under the key prefix Twitch used for them. */
function person(data: Rec, prefix = "user"): CreditsPerson | null {
  const id = str(data[`${prefix}_id`]);
  if (!id) return null;
  const login = str(data[`${prefix}_login`]);
  const name = str(data[`${prefix}_name`]) ?? login ?? id;
  return { user_id: id, login, name };
}

function anonymous(): CreditsPerson {
  return { user_id: null, login: null, name: CREDITS_ANONYMOUS_NAME };
}

/**
 * Keeps one entry per user in first-seen order, adding `value` on repeats.
 * The anonymous bucket is kept aside and appended last by `finish`.
 */
class PeopleTally {
  private readonly byId = new Map<string, CreditsPerson>();
  private anon: CreditsPerson | null = null;

  add(p: CreditsPerson, value?: number) {
    if (p.user_id === null) {
      if (!this.anon) this.anon = { ...p };
      if (value !== undefined) this.anon.value = (this.anon.value ?? 0) + value;
      return;
    }
    const existing = this.byId.get(p.user_id);
    if (existing) {
      if (value !== undefined) existing.value = (existing.value ?? 0) + value;
      return;
    }
    this.byId.set(p.user_id, value !== undefined ? { ...p, value } : { ...p });
  }

  has(userId: string | null): boolean {
    return userId !== null && this.byId.has(userId);
  }

  /** The named entry for `userId`, to adjust in place. */
  peek(userId: string): CreditsPerson | undefined {
    return this.byId.get(userId);
  }

  remove(userId: string) {
    this.byId.delete(userId);
  }

  get size(): number {
    return this.byId.size + (this.anon ? 1 : 0);
  }

  /** `byValue` sorts named people by value, highest first; ties keep first-seen order. */
  finish(byValue = false): CreditsPerson[] {
    const named = [...this.byId.values()];
    if (byValue) {
      named.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    }
    return this.anon ? [...named, this.anon] : named;
  }
}

function parseTime(value: string | null): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

// ─── Roll-up ────────────────────────────────────────────────────────────────

/**
 * Rolls one stream's events into credits. Rows must be in the order they
 * happened (created_at ascending); the lists keep that order where it means
 * something (followers, raids) and sort by size where that reads better
 * (gifters, cheerers, redeemers).
 *
 * Rules worth knowing:
 * - A gift bomb is one `channel.subscription.gift` plus one `channel.subscribe`
 *   with `is_gift: true` per recipient. Gifters get the gift event's `total`;
 *   the recipients' rows are skipped so the gift isn't counted twice.
 * - Someone who resubbed is listed under resubs only, even if a subscribe row
 *   for them exists too.
 * - Anonymous gifts and cheers fold into one "Anonymous" entry per section,
 *   placed last.
 * - Only raids *into* this channel count. Outgoing raids aren't subscribed,
 *   but a stray row is filtered on `to_broadcaster_user_id` all the same.
 */
export function aggregateCredits(rows: readonly CreditsEventRow[], meta: CreditsStreamMeta): CreditsData {
  const now = meta.now ?? Date.now();
  const followers = new PeopleTally();
  const subs = new PeopleTally();
  const resubs = new PeopleTally();
  const gifters = new PeopleTally();
  const cheerers = new PeopleTally();
  const raids = new PeopleTally();
  const redeemers = new PeopleTally();
  const trains = new Map<string, { level: number; total: number }>();
  let giftSubs = 0;
  let bits = 0;
  let raidCount = 0;
  let redemptionCount = 0;
  let endedAt: string | null = null;
  let endedOffset: number | null = null;
  let lastAt: string | null = null;

  for (const row of rows) {
    const data = rec(row.event_data);
    if (!data) continue;
    lastAt = row.created_at;

    switch (row.event_type) {
      case "channel.follow": {
        const p = person(data);
        if (p) followers.add(p);
        break;
      }
      case "channel.subscribe": {
        // Gift recipients come in through the gift event.
        if (data.is_gift === true) break;
        const p = person(data);
        if (p && !resubs.has(p.user_id)) subs.add(p);
        break;
      }
      case "channel.subscription.message": {
        const p = person(data);
        if (!p) break;
        const months = int(data.cumulative_months) ?? 0;
        if (p.user_id && subs.has(p.user_id)) subs.remove(p.user_id);
        const existing = p.user_id ? resubs.peek(p.user_id) : undefined;
        if (existing) {
          // Keep the highest month count seen.
          if ((existing.value ?? 0) < months) existing.value = months;
        } else {
          resubs.add({ ...p, value: months });
        }
        break;
      }
      case "channel.subscription.gift": {
        const total = int(data.total) ?? 1;
        giftSubs += total;
        const p = data.is_anonymous === true ? anonymous() : (person(data) ?? anonymous());
        gifters.add(p, total);
        break;
      }
      case "channel.cheer": {
        const amount = int(data.bits) ?? 0;
        bits += amount;
        const p = data.is_anonymous === true ? anonymous() : (person(data) ?? anonymous());
        cheerers.add(p, amount);
        break;
      }
      case "channel.raid": {
        if (str(data.to_broadcaster_user_id) !== meta.broadcaster_id) break;
        const p = person(data, "from_broadcaster_user");
        if (!p) break;
        raidCount += 1;
        raids.add(p, int(data.viewers) ?? 0);
        break;
      }
      case "channel.channel_points_custom_reward_redemption.add": {
        const p = person(data);
        if (!p) break;
        redemptionCount += 1;
        redeemers.add(p, 1);
        break;
      }
      case "channel.hype_train.begin":
      case "channel.hype_train.progress":
      case "channel.hype_train.end": {
        const id = str(data.id);
        if (!id) break;
        const level = int(data.level) ?? 0;
        const total = int(data.total) ?? 0;
        const t = trains.get(id);
        if (t) {
          t.level = Math.max(t.level, level);
          t.total = Math.max(t.total, total);
        } else {
          trains.set(id, { level, total });
        }
        break;
      }
      case "stream.offline": {
        endedAt = row.created_at;
        endedOffset = row.offset_seconds;
        break;
      }
      default:
        break;
    }
  }

  // A stream.offline row is the real end. Without one, and not live, the last
  // event we saw is the best guess we have.
  if (!endedAt && !meta.is_live) endedAt = lastAt;

  const startedMs = parseTime(meta.started_at);
  const endedMs = parseTime(endedAt);
  let durationSeconds: number | null = null;
  if (startedMs !== null && endedMs !== null) {
    durationSeconds = Math.max(0, Math.floor((endedMs - startedMs) / 1000));
  } else if (endedOffset !== null) {
    durationSeconds = Math.max(0, endedOffset);
  } else if (meta.is_live && startedMs !== null) {
    durationSeconds = Math.max(0, Math.floor((now - startedMs) / 1000));
  }

  let hype: CreditsData["hype_train"] = null;
  if (trains.size > 0) {
    let topLevel = 0;
    let topTotal = 0;
    for (const t of trains.values()) {
      topLevel = Math.max(topLevel, t.level);
      topTotal = Math.max(topTotal, t.total);
    }
    hype = { count: trains.size, top_level: topLevel, top_total: topTotal };
  }

  const followerList = followers.finish();
  const subList = subs.finish();
  const resubList = resubs.finish();

  return {
    stream_id: meta.stream_id,
    is_live: meta.is_live,
    started_at: meta.started_at,
    ended_at: meta.is_live ? null : endedAt,
    duration_seconds: durationSeconds,
    peak_viewers: meta.peak_viewers,
    followers: followerList,
    subs: subList,
    resubs: resubList,
    gifters: gifters.finish(true),
    cheerers: cheerers.finish(true),
    raids: raids.finish(),
    redeemers: redeemers.finish(true),
    hype_train: hype,
    counts: {
      followers: followerList.length,
      subs: subList.length,
      resubs: resubList.length,
      gift_subs: giftSubs,
      bits,
      raids: raidCount,
      redemptions: redemptionCount,
      hype_trains: trains.size,
    },
    missing: {
      stream: false,
      events: rows.length === 0,
      viewers: meta.peak_viewers === null,
    },
    generated_at: new Date(now).toISOString(),
  };
}

/** Credits with nothing in them, for a channel with no stream to read. */
export function emptyCredits(reason: "stream" | "events", now = Date.now()): CreditsData {
  return {
    stream_id: null,
    is_live: false,
    started_at: null,
    ended_at: null,
    duration_seconds: null,
    peak_viewers: null,
    followers: [],
    subs: [],
    resubs: [],
    gifters: [],
    cheerers: [],
    raids: [],
    redeemers: [],
    hype_train: null,
    counts: { followers: 0, subs: 0, resubs: 0, gift_subs: 0, bits: 0, raids: 0, redemptions: 0, hype_trains: 0 },
    missing: { stream: reason === "stream", events: true, viewers: true },
    generated_at: new Date(now).toISOString(),
  };
}

// ─── Sample data ────────────────────────────────────────────────────────────

/**
 * Names for the sample roll. Enough followers to trip the "and N more" line at
 * the default limit, and a spread of everything else so every section has
 * something to show.
 */
const DEMO_NAMES = [
  "sandwichlord", "ninetoad", "pixelpenny", "grumpycatto", "lo_fi_lars", "mossgirl", "byte_me",
  "cheesewheel", "quietstorm", "raccoonhours", "tallglass", "nocturnalnat", "softserve", "zed_ex",
  "marblemouth", "wobbleboss", "teacup_tim", "frostyfen", "dinoemu", "papertiger", "ghostnote",
  "sunnyside", "velvetvix", "kettlecorn", "lemonlime", "polarpaws", "riverrun", "static_sam",
  "toastmaster", "umbrellaguy", "violetvale", "wintermute", "yellowyak",
] as const;

const DEMO_STREAM_ID = "demo-credits-stream";
const DEMO_BROADCASTER_ID = "2";

/** Builds a `stream_events`-shaped row from one of the widget test events, for user `index`. */
function demoRow(
  type: keyof typeof WIDGET_TEST_EVENTS,
  index: number,
  offsetSeconds: number,
  startedMs: number,
  patch: Record<string, unknown> = {},
): CreditsEventRow {
  const name = DEMO_NAMES[index % DEMO_NAMES.length]!;
  const id = String(100 + index);
  const built = WIDGET_TEST_EVENTS[type].build({ userName: name }) as Record<string, unknown>;
  const data: Record<string, unknown> = { ...built };
  // The fixtures share one viewer id; give each name its own.
  if ("user_id" in data) {
    data.user_id = id;
    data.user_login = name;
    data.user_name = name;
  }
  if ("from_broadcaster_user_id" in data) {
    data.from_broadcaster_user_id = id;
    data.from_broadcaster_user_login = name;
    data.from_broadcaster_user_name = name;
  }
  Object.assign(data, patch);
  return {
    event_type: type,
    event_data: data,
    created_at: new Date(startedMs + offsetSeconds * 1000).toISOString(),
    offset_seconds: offsetSeconds,
  };
}

/**
 * Sample credits for the editor's "Roll with sample data" button, built by
 * running fixture events through {@link aggregateCredits}. Same code path as a
 * real stream, so what the streamer previews is what they'll get.
 */
export function buildDemoCreditsData(now = Date.now()): CreditsData {
  const durationSeconds = 3 * 3600 + 12 * 60;
  const startedMs = now - durationSeconds * 1000 - 5 * 60_000;
  const rows: CreditsEventRow[] = [];
  let t = 30;
  const step = () => (t += 137);

  // 33 followers: over the default per-section limit, so the overflow line shows.
  for (let i = 0; i < DEMO_NAMES.length; i++) rows.push(demoRow("channel.follow", i, step(), startedMs));
  // A second follow from the same person: counted once.
  rows.push(demoRow("channel.follow", 0, step(), startedMs));

  for (const i of [3, 7, 11, 15]) rows.push(demoRow("channel.subscribe", i, step(), startedMs));
  for (const [i, months] of [[1, 14], [5, 3], [9, 27]] as const) {
    rows.push(demoRow("channel.subscription.message", i, step(), startedMs, { cumulative_months: months }));
  }
  // A gift bomb: the gift event plus its recipients' subscribe rows.
  rows.push(demoRow("channel.subscription.gift", 0, step(), startedMs, { total: 5, cumulative_total: 12 }));
  for (const i of [20, 21, 22, 23, 24]) {
    rows.push(demoRow("channel.subscribe", i, t, startedMs, { is_gift: true }));
  }
  rows.push(demoRow("channel.subscription.gift", 2, step(), startedMs, { total: 1, cumulative_total: 1 }));
  rows.push(
    demoRow("channel.subscription.gift", 0, step(), startedMs, {
      total: 2,
      is_anonymous: true,
      user_id: null,
      user_login: null,
      user_name: null,
    }),
  );

  for (const [i, amount] of [[4, 1500], [8, 500], [12, 100], [4, 250]] as const) {
    rows.push(demoRow("channel.cheer", i, step(), startedMs, { bits: amount }));
  }
  rows.push(
    demoRow("channel.cheer", 0, step(), startedMs, {
      bits: 300,
      is_anonymous: true,
      user_id: null,
      user_login: null,
      user_name: null,
    }),
  );

  for (const [i, viewers] of [[6, 42], [13, 118]] as const) {
    rows.push(demoRow("channel.raid", i, step(), startedMs, { viewers }));
  }

  for (const i of [2, 2, 2, 10, 10, 16]) {
    rows.push(demoRow("channel.channel_points_custom_reward_redemption.add", i, step(), startedMs));
  }

  const trainId = "demo-hype-train";
  rows.push(demoRow("channel.hype_train.begin", 0, step(), startedMs, { id: trainId, level: 1, total: 1200 }));
  rows.push(demoRow("channel.hype_train.end", 0, step(), startedMs, { id: trainId, level: 4, total: 9400 }));

  rows.push({
    event_type: "stream.offline",
    event_data: WIDGET_TEST_EVENTS["stream.offline"].build(),
    created_at: new Date(startedMs + durationSeconds * 1000).toISOString(),
    offset_seconds: durationSeconds,
  });

  return aggregateCredits(rows, {
    stream_id: DEMO_STREAM_ID,
    broadcaster_id: DEMO_BROADCASTER_ID,
    is_live: false,
    started_at: new Date(startedMs).toISOString(),
    peak_viewers: 87,
    now,
  });
}
