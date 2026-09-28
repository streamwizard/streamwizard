/**
 * Hype train tracking. Pure: every function takes a state and returns the next
 * one, and returns the same object when nothing changed so React can skip the
 * render.
 *
 * `riders` stays in join order; the renderer ranks them by support with
 * `rankRiders`. The train is on screen for the whole hype train: it rolls in on `begin`,
 * keeps riding while the train runs, and leaves after `end`. Twitch's hype
 * train events (v2) only name the top contributor per type, so the riders are
 * collected from the contributions themselves: cheers, subs, resubs and gift
 * subs that arrive while a train runs. Contributions from the few minutes
 * before a train starts count too, because those are what started it.
 * `top_contributions` is merged in as well, which also seeds the train when the
 * overlay loads halfway through one.
 */

export interface HypeTrainRider {
  /** Twitch user id, or `anonymous` for every anonymous contribution together. */
  id: string;
  login: string;
  name: string;
  /** From the event when StreamWizard added one; the renderer fetches the rest. */
  avatar: string | null;
  bits: number;
  subs: number;
  /** Sub value the way Twitch scores it for the train: 500 per tier 1 sub. */
  subPoints: number;
  other: number;
  joinedAt: number;
}

interface RecentContribution {
  rider: HypeTrainRider;
  at: number;
}

export interface HypeTrainState {
  trainId: string | null;
  /** The hype train is running. */
  active: boolean;
  /** The train is on screen: from the start until it has driven off after the end. */
  showing: boolean;
  /** New per train, so the renderer starts a fresh ride and knows which one finished. */
  rideKey: number;
  level: number;
  /** Golden Kappa and treasure trains get their own paint. */
  trainType: string;
  /** In the order they joined. The train shows them ranked, see `rankRiders`. */
  riders: HypeTrainRider[];
  /** Contributions while no train runs, in case one is about to start. */
  recent: RecentContribution[];
  /** When Twitch says the train runs out without more contributions, in ms. */
  expiresAt: number | null;
}

export interface HypeTrainFrame {
  type?: string;
  payload?: unknown;
}

export const EMPTY_HYPE_TRAIN_STATE: HypeTrainState = {
  trainId: null,
  active: false,
  showing: false,
  rideKey: 0,
  level: 0,
  trainType: "regular",
  riders: [],
  recent: [],
  expiresAt: null,
};

/** A train needs its contributions to land within this window to start. */
export const HYPE_TRAIN_LEAD_IN_MS = 5 * 60 * 1000;
/**
 * How long past `expires_at` the train keeps riding without an `end`. The end
 * event normally lands first; this only clears the screen when it went missing.
 */
export const HYPE_TRAIN_EXPIRY_GRACE_MS = 30 * 1000;
/** For a train whose events carried no `expires_at`. */
const FALLBACK_EXPIRY_MS = 10 * 60 * 1000;
const MAX_RECENT = 100;
const MAX_RIDERS = 2000;

const TIER_POINTS: Record<string, number> = { "1000": 500, "2000": 1000, "3000": 2500 };
/** Points per tier 1 sub, to turn a subscription contribution back into a count. */
const SUB_POINTS = 500;

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function emptyRider(id: string, login: string, name: string, at: number): HypeTrainRider {
  return { id, login, name, avatar: null, bits: 0, subs: 0, subPoints: 0, other: 0, joinedAt: at };
}

/** The rider a cheer or sub event describes, or null when it isn't a contribution. */
export function contributionFromFrame(frame: HypeTrainFrame, at: number): HypeTrainRider | null {
  const p = (frame.payload ?? {}) as Record<string, unknown>;
  const anonymous = p.is_anonymous === true || !str(p.user_id);
  const rider = anonymous
    ? emptyRider("anonymous", "anonymous", "Anonymous", at)
    : emptyRider(str(p.user_id), str(p.user_login), str(p.user_name) || str(p.user_login), at);
  if (!anonymous) rider.avatar = str(p.user_profile_image_url) || null;
  const tierPoints = TIER_POINTS[str(p.tier)] ?? SUB_POINTS;

  switch (frame.type) {
    case "channel.cheer": {
      const bits = num(p.bits);
      if (bits <= 0) return null;
      rider.bits = bits;
      return rider;
    }
    case "channel.subscribe":
      // A gifted sub lands here for the receiver; the gifter's event counts it.
      if (p.is_gift === true || anonymous) return null;
      rider.subs = 1;
      rider.subPoints = tierPoints;
      return rider;
    case "channel.subscription.message":
      if (anonymous) return null;
      rider.subs = 1;
      rider.subPoints = tierPoints;
      return rider;
    case "channel.subscription.gift": {
      const total = Math.max(1, num(p.total));
      rider.subs = total;
      rider.subPoints = total * tierPoints;
      return rider;
    }
    default:
      return null;
  }
}

/** Adds a contribution on top of what a rider already gave. */
function addRider(riders: HypeTrainRider[], add: HypeTrainRider): HypeTrainRider[] {
  const i = riders.findIndex((r) => r.id === add.id);
  if (i === -1) return riders.length >= MAX_RIDERS ? riders : [...riders, add];
  const r = riders[i]!;
  const next = [...riders];
  next[i] = {
    ...r,
    login: add.login || r.login,
    name: add.name || r.name,
    avatar: add.avatar ?? r.avatar,
    bits: r.bits + add.bits,
    subs: r.subs + add.subs,
    subPoints: r.subPoints + add.subPoints,
    other: r.other + add.other,
  };
  return next;
}

/**
 * Merges Twitch's own top contributors. Their totals are for the whole train,
 * so they raise what we counted (we may have missed events) but never add to it.
 */
function mergeTopContributions(riders: HypeTrainRider[], payload: Record<string, unknown>, at: number): HypeTrainRider[] {
  const list = Array.isArray(payload.top_contributions) ? payload.top_contributions : [];
  let next = riders;
  for (const raw of list) {
    const c = (raw ?? {}) as Record<string, unknown>;
    const id = str(c.user_id);
    const total = num(c.total);
    if (!id || total <= 0) continue;
    let i = next.findIndex((r) => r.id === id);
    if (i === -1) {
      if (next.length >= MAX_RIDERS) continue;
      next = [...next, emptyRider(id, str(c.user_login), str(c.user_name) || str(c.user_login), at)];
      i = next.length - 1;
    } else {
      next = [...next];
    }
    const r = { ...next[i]! };
    if (c.type === "bits") r.bits = Math.max(r.bits, total);
    else if (c.type === "subscription") {
      r.subPoints = Math.max(r.subPoints, total);
      r.subs = Math.max(r.subs, Math.round(total / SUB_POINTS));
    } else r.other = Math.max(r.other, total);
    next[i] = r;
  }
  return next;
}

/** Whoever chipped in during the lead-in started this train. */
function leadInRiders(state: HypeTrainState, at: number): HypeTrainRider[] {
  let riders: HypeTrainRider[] = [];
  for (const c of state.recent) if (at - c.at <= HYPE_TRAIN_LEAD_IN_MS) riders = addRider(riders, c.rider);
  return riders;
}

function expiry(payload: Record<string, unknown>, at: number): number {
  const t = Date.parse(str(payload.expires_at));
  return Number.isFinite(t) ? t : at + FALLBACK_EXPIRY_MS;
}

/** A train rolling in, from its `begin` or, loaded mid-train, its first `progress`. */
function startTrain(state: HypeTrainState, p: Record<string, unknown>, at: number): HypeTrainState {
  return {
    ...state,
    trainId: str(p.id) || null,
    active: true,
    showing: true,
    rideKey: state.rideKey + 1,
    level: Math.max(1, num(p.level)),
    trainType: str(p.type) || "regular",
    riders: mergeTopContributions(leadInRiders(state, at), p, at),
    recent: [],
    expiresAt: expiry(p, at),
  };
}

/** One websocket frame. `at` is now, in ms. */
export function applyHypeTrainFrame(state: HypeTrainState, frame: HypeTrainFrame, at: number): HypeTrainState {
  const type = frame?.type;
  if (!type) return state;
  const p = (frame.payload ?? {}) as Record<string, unknown>;
  const id = str(p.id);
  const sameTrain = state.active && (!id || id === state.trainId);

  if (type === "channel.hype_train.begin") {
    return sameTrain ? state : startTrain(state, p, at);
  }

  if (type === "channel.hype_train.progress") {
    if (!sameTrain) return startTrain(state, p, at);
    return {
      ...state,
      level: Math.max(state.level, num(p.level)),
      riders: mergeTopContributions(state.riders, p, at),
      expiresAt: expiry(p, at),
    };
  }

  if (type === "channel.hype_train.end") {
    // Loaded after the train ended: nothing to show.
    if (!sameTrain) return state;
    return {
      ...state,
      active: false,
      level: Math.max(state.level, num(p.level)),
      riders: mergeTopContributions(state.riders, p, at),
      expiresAt: null,
    };
  }

  const rider = contributionFromFrame(frame, at);
  if (!rider) return state;
  if (state.active) return { ...state, riders: addRider(state.riders, rider) };
  const recent = [...state.recent.filter((c) => at - c.at <= HYPE_TRAIN_LEAD_IN_MS), { rider, at }];
  return { ...state, recent: recent.slice(-MAX_RECENT) };
}

/** Ends a train whose `end` never came, once it is well past its expiry. */
export function expireHypeTrain(state: HypeTrainState, at: number): HypeTrainState {
  if (!state.active || state.expiresAt === null || at < state.expiresAt + HYPE_TRAIN_EXPIRY_GRACE_MS) return state;
  return { ...state, active: false, expiresAt: null };
}

/** The train of this ride has driven off after its end. */
export function hypeTrainGone(state: HypeTrainState, rideKey: number): HypeTrainState {
  if (state.rideKey !== rideKey || state.active || !state.showing) return state;
  return { ...state, showing: false };
}

/** Fills in fetched avatars. */
export function applyAvatars(state: HypeTrainState, avatars: Record<string, string>): HypeTrainState {
  let changed = false;
  const riders = state.riders.map((r) => {
    const url = avatars[r.id];
    if (!url || r.avatar) return r;
    changed = true;
    return { ...r, avatar: url };
  });
  return changed ? { ...state, riders } : state;
}

export function riderScore(r: HypeTrainRider): number {
  return r.bits + r.subPoints + r.other;
}

export interface RankedRider {
  rider: HypeTrainRider;
  /** Place in the join order. Stays put when the ranking changes, so a wagon keeps its paint. */
  joinIndex: number;
}

/** Biggest supporters first, nearest the engine; ties keep the order they joined in. */
export function rankRiders(riders: readonly HypeTrainRider[]): RankedRider[] {
  return riders
    .map((rider, joinIndex) => ({ rider, joinIndex, score: riderScore(rider) }))
    .sort((a, b) => b.score - a.score || a.joinIndex - b.joinIndex)
    .map(({ rider, joinIndex }) => ({ rider, joinIndex }));
}

/** "1.2K bits · 3 subs". Empty for a rider Twitch only gave an "other" total for. */
export function formatRiderAmount(r: HypeTrainRider): string {
  const parts: string[] = [];
  if (r.bits > 0) parts.push(`${compact(r.bits)} bits`);
  if (r.subs > 0) parts.push(r.subs === 1 ? "1 sub" : `${compact(r.subs)} subs`);
  return parts.join(" · ");
}

function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 100_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`;
  return `${Math.round(n / 1000)}K`;
}
