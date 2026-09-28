import type { OverlayGeoEvent } from "./streamwizard";
import { DEMO_POLL_ID, WIDGET_TEST_EVENTS } from "./widget-test-events";
import { AUTO_SWITCHER_PRESET_THRESHOLDS, type AutoSwitcherStatus } from "./auto-switcher";
import { buildDemoSwitcherStatus } from "./widget-demo-events";

/**
 * The maths behind the looping demo simulators, kept apart from the timers that
 * drive them (those live in @repo/ui) so every tick can be asserted against its
 * zod schema in a plain unit test.
 *
 * `now` and `rand` are injected rather than read from the ambient globals --
 * a simulator that can't be replayed deterministically can't be tested.
 */

const EARTH_RADIUS_M = 6371000;
const DEG = Math.PI / 180;

export interface GeoWalkOptions {
  startLat?: number;
  startLon?: number;
  startHeading?: number;
  /** Metres per second at the middle of the speed curve. */
  baseSpeedMs?: number;
  /** Amplitude of the sine the speed swings through. */
  speedSwingMs?: number;
  speedPeriodMs?: number;
  /** Maximum heading change per tick, in degrees. */
  headingJitterDeg?: number;
  accuracy?: number;
  altitude?: number;
}

export interface GeoWalkState {
  lat: number;
  lon: number;
  heading: number;
  startedAt: number;
}

/** Amsterdam, matching the start point hand-rolled widget demo modes used. */
const GEO_WALK_DEFAULTS: Required<GeoWalkOptions> = {
  startLat: 52.3676,
  startLon: 4.9041,
  startHeading: 45,
  baseSpeedMs: 9,
  speedSwingMs: 6,
  speedPeriodMs: 9000,
  headingJitterDeg: 8,
  accuracy: 8,
  altitude: 6,
};

export function initGeoWalk(opts?: GeoWalkOptions, now = Date.now()): GeoWalkState {
  const o = { ...GEO_WALK_DEFAULTS, ...opts };
  return { lat: o.startLat, lon: o.startLon, heading: o.startHeading, startedAt: now };
}

/**
 * Advances the walk one tick and returns the geo event to deliver. Speed rides
 * a sine so the reading is never suspiciously constant; heading drifts by a
 * bounded random step so the track curves instead of running in a straight
 * line forever.
 */
export function stepGeoWalk(
  state: GeoWalkState,
  opts?: GeoWalkOptions,
  now = Date.now(),
  rand: () => number = Math.random
): { state: GeoWalkState; event: OverlayGeoEvent } {
  const o = { ...GEO_WALK_DEFAULTS, ...opts };

  const speed = o.baseSpeedMs + Math.sin(now / o.speedPeriodMs) * o.speedSwingMs;
  const heading = (state.heading + (rand() - 0.5) * o.headingJitterDeg + 360) % 360;
  const bearing = heading * DEG;

  const lat = state.lat + ((speed * Math.cos(bearing)) / EARTH_RADIUS_M) / DEG;
  // Longitude degrees shrink as you move away from the equator, so the east
  // component is scaled by the cosine of the current latitude.
  const lon =
    state.lon + ((speed * Math.sin(bearing)) / (EARTH_RADIUS_M * Math.cos(lat * DEG))) / DEG;

  return {
    state: { ...state, lat, lon, heading },
    event: {
      status: "connected",
      payload: {
        latitude: lat,
        longitude: lon,
        altitude: o.altitude,
        speed,
        heading,
        accuracy: o.accuracy,
        timestamp: now,
      },
    },
  };
}

export interface ChatStreamOptions {
  /** Cycled in order, so a run is reproducible. */
  messages?: readonly { userName: string; text: string }[];
}

export interface ChatStreamState {
  index: number;
}

const CHAT_STREAM_DEFAULTS: readonly { userName: string; text: string }[] = [
  { userName: "Pixelroach", text: "first" },
  { userName: "Vexolotl", text: "this overlay goes hard" },
  { userName: "MossKnight", text: "what game is this" },
  { userName: "Nimbusless", text: "chat is so quiet today" },
  { userName: "Quillfire", text: "o7" },
  { userName: "Dustvane", text: "the widget looks great" },
];

export function initChatStream(): ChatStreamState {
  return { index: 0 };
}

/**
 * Emits the next canned chat message. Delegates to the shared EventSub fixture
 * so the payload can't drift from the real `channel.chat.message` shape -- only
 * the chatter and the text are swapped.
 */
export function stepChatStream(
  state: ChatStreamState,
  opts?: ChatStreamOptions
): { state: ChatStreamState; event: Record<string, unknown> } {
  const messages = opts?.messages?.length ? opts.messages : CHAT_STREAM_DEFAULTS;
  const line = messages[state.index % messages.length]!;

  const event = WIDGET_TEST_EVENTS["channel.chat.message"].build({ userName: line.userName });
  event.message = { text: line.text, fragments: [{ type: "text", text: line.text }] };

  return { state: { index: state.index + 1 }, event };
}

export interface SwitcherDegradeOptions {
  /** Ticks the link stays healthy before bitrate starts failing. */
  healthyTicks?: number;
  thresholds?: AutoSwitcherStatus["thresholds"];
}

export interface SwitcherDegradeState {
  tick: number;
}

// Balanced rather than fast on purpose: with `fast` the trigger is 2 polls and
// the warning band also shows at 2, so the "about to switch" moment and the
// switch itself land on the same tick and the build-up is invisible -- the very
// thing this simulator exists to show.
const SWITCHER_DEGRADE_DEFAULTS: Required<SwitcherDegradeOptions> = {
  healthyTicks: 5,
  thresholds: AUTO_SWITCHER_PRESET_THRESHOLDS.balanced,
};

/** Mirrors user-monitor.ts's WARNING_SHOW_BAD_POLLS, which is fixed in v1. */
const WARNING_SHOW_BAD_POLLS = 2;

export function initSwitcherDegrade(): SwitcherDegradeState {
  return { tick: 0 };
}

/**
 * Walks one full degrade/recover arc of the auto switcher and loops: healthy,
 * then bitrate failing one poll at a time until the trigger fires the switch,
 * then good polls climbing back to the recover threshold. Only bitrate fails --
 * a single-metric failure is both the common case and the one that shows a
 * status widget hiding the two healthy metrics.
 *
 * The engine publishes on every sample while a streak is moving (see
 * statusKey() in user-monitor.ts), so one tick here equals one published status
 * there. That correspondence is the point: it's the only way to see the bars
 * fill without throttling a real uplink.
 */
export function stepSwitcherDegrade(
  state: SwitcherDegradeState,
  opts?: SwitcherDegradeOptions,
  now = Date.now()
): { state: SwitcherDegradeState; event: Record<string, unknown> } {
  const o = { ...SWITCHER_DEGRADE_DEFAULTS, ...opts };
  const thr = o.thresholds;
  const trigger = thr.bitrate_trigger_polls;
  const recover = thr.bitrate_recover_polls;
  const cycle = o.healthyTicks + trigger + recover;

  const t = state.tick % cycle;
  const next = { tick: state.tick + 1 };

  const goodStreak = (good: number) => ({
    bitrate: { bad: 0, good },
    rtt: { bad: 0, good },
    loss: { bad: 0, good },
  });

  // Healthy: bitrate comfortably over the floor, nothing to draw.
  if (t < o.healthyTicks) {
    return {
      state: next,
      event: status({
        state: "live",
        streaks: goodStreak(recover + t),
        thresholds: thr,
        latest: { kbps: 6000, rtt_ms: 42, loss_pct: 0.2, at: now },
      }),
    };
  }

  // Failing: bad climbs 1..trigger. The switch lands on the tick that reaches
  // the trigger, so that tick reports the new phase already.
  if (t < o.healthyTicks + trigger) {
    const bad = t - o.healthyTicks + 1;
    const switched = bad >= trigger;
    const kbps = Math.max(120, thr.bitrate_min_kbps - 220 * bad);
    return {
      state: next,
      event: status({
        state: switched ? "degraded" : "live",
        // The engine zeroes every streak on the way into the fallback scene, so
        // the bad bar vanishes the instant it fires rather than sitting full.
        streaks: switched
          ? goodStreak(0)
          : { bitrate: { bad, good: 0 }, rtt: { bad: 0, good: 0 }, loss: { bad: 0, good: 0 } },
        thresholds: thr,
        warning_shown: !switched && bad >= WARNING_SHOW_BAD_POLLS,
        latest: { kbps, rtt_ms: 42 + 30 * bad, loss_pct: 0.2 * bad, at: now },
        last_switch: switched
          ? {
              at: now,
              from_scene: "Live",
              to_scene: "Connection Lost",
              reason: "auto_fallback",
              detail: `bitrate ${kbps} kbps < ${thr.bitrate_min_kbps} kbps`,
              session_id: "demo-session",
              label: "Camera 1",
            }
          : null,
      }),
    };
  }

  // Recovering: good climbs 1..recover, and the last tick of the arc is back
  // on the live scene.
  const good = t - o.healthyTicks - trigger + 1;
  const recovered = good >= recover;
  return {
    state: next,
    event: status({
      state: recovered ? "live" : "degraded",
      streaks: goodStreak(good),
      thresholds: thr,
      latest: { kbps: 5200, rtt_ms: 48, loss_pct: 0.1, at: now },
      last_switch: {
        at: now,
        from_scene: recovered ? "Connection Lost" : "Live",
        to_scene: recovered ? "Live" : "Connection Lost",
        reason: recovered ? "auto_recover" : "auto_fallback",
        detail: recovered ? "link stable (5200 kbps, 48 ms RTT)" : "bitrate below floor",
        session_id: "demo-session",
        label: "Camera 1",
      },
    }),
  };
}

function status(patch: Partial<AutoSwitcherStatus>): Record<string, unknown> {
  return buildDemoSwitcherStatus(patch) as unknown as Record<string, unknown>;
}

export interface PollCycleOptions {
  /** Seconds (ticks) the poll takes votes for. */
  voteTicks?: number;
  /** Ticks of quiet after the close, so the result shows and hides before the next poll. */
  pauseTicks?: number;
}

export interface PollCycleState {
  /** Which poll of the run this is; picks the question and the id. */
  cycle: number;
  /** Tick within the cycle: 0 begins, then votes, then the close, then the pause. */
  tick: number;
  votes: number[];
  startedAt: number;
  /** Pseudo-random seed, so a run replays exactly. */
  seed: number;
}

const POLL_CYCLE_QUESTIONS: readonly { title: string; choices: readonly string[]; favourite: number }[] = [
  { title: "What do we play next?", choices: ["Elden Ring", "Hades II", "Balatro"], favourite: 2 },
  { title: "Aren't shoes just hard socks?", choices: ["Hard socks", "Absolutely not"], favourite: 0 },
  { title: "Pick tonight's challenge", choices: ["No healing", "Only pistols", "Blindfolded boss", "Speedrun"], favourite: 1 },
];

const POLL_CYCLE_DEFAULTS = { voteTicks: 20, pauseTicks: 13 };

export function initPollCycle(now = Date.now(), seed = 1): PollCycleState {
  return { cycle: 0, tick: 0, votes: [], startedAt: now, seed };
}

function nextRand(seed: number): { seed: number; value: number } {
  // Park–Miller: small, deterministic, good enough for vote noise.
  const next = (seed * 48271) % 2147483647;
  return { seed: next, value: next / 2147483647 };
}

/**
 * One second of a looping poll: it begins, votes trickle in (one choice
 * pulls ahead, the rest keep it close), it closes with a winner, and after a
 * pause the next poll begins with a new question. `listener: null` is a quiet
 * tick with nothing to send.
 *
 * Each poll gets its own `demo-poll-…` id, so widgets treat it as a test poll
 * and play the entrance again for every new one.
 */
export function stepPollCycle(
  state: PollCycleState,
  now = Date.now(),
  opts?: PollCycleOptions
): { state: PollCycleState; listener: string | null; event: Record<string, unknown> | null } {
  const voteTicks = opts?.voteTicks ?? POLL_CYCLE_DEFAULTS.voteTicks;
  const pauseTicks = opts?.pauseTicks ?? POLL_CYCLE_DEFAULTS.pauseTicks;
  const question = POLL_CYCLE_QUESTIONS[state.cycle % POLL_CYCLE_QUESTIONS.length]!;
  const id = `${DEMO_POLL_ID}-sim-${state.cycle}`;
  const tick = state.tick;
  const advance = (patch: Partial<PollCycleState>): PollCycleState => ({ ...state, tick: tick + 1, ...patch });

  const base = {
    id,
    broadcaster_user_id: "2",
    broadcaster_user_login: "broadcaster",
    broadcaster_user_name: "Broadcaster",
    title: question.title,
    bits_voting: { is_enabled: false, amount_per_vote: 0 },
    channel_points_voting: { is_enabled: true, amount_per_vote: 100 },
  };
  const withVotes = (votes: number[]) =>
    question.choices.map((title, i) => ({
      id: String(i + 1),
      title,
      bits_votes: 0,
      channel_points_votes: Math.round(votes[i]! * 0.2),
      votes: votes[i]!,
    }));

  if (tick === 0) {
    const startedAt = now;
    return {
      state: advance({ votes: question.choices.map(() => 0), startedAt }),
      listener: "channel.poll.begin",
      event: {
        ...base,
        choices: question.choices.map((title, i) => ({ id: String(i + 1), title })),
        started_at: new Date(startedAt).toISOString(),
        ends_at: new Date(startedAt + (voteTicks + 1) * 1000).toISOString(),
      },
    };
  }

  if (tick <= voteTicks) {
    let seed = state.seed;
    const votes = state.votes.map((v, i) => {
      const r = nextRand(seed);
      seed = r.seed;
      // The favourite gets a little more on average, so there is a winner
      // but the race stays close enough to watch.
      const weight = i === question.favourite ? 5 : 3.5;
      return v + Math.floor(r.value * weight);
    });
    return {
      state: advance({ votes, seed }),
      listener: "channel.poll.progress",
      event: {
        ...base,
        choices: withVotes(votes),
        started_at: new Date(state.startedAt).toISOString(),
        ends_at: new Date(state.startedAt + (voteTicks + 1) * 1000).toISOString(),
      },
    };
  }

  if (tick === voteTicks + 1) {
    return {
      state: advance({}),
      listener: "channel.poll.end",
      event: {
        ...base,
        choices: withVotes(state.votes),
        status: "completed",
        started_at: new Date(state.startedAt).toISOString(),
        ended_at: new Date(now).toISOString(),
      },
    };
  }

  // The pause, then the next poll.
  if (tick < voteTicks + 1 + pauseTicks) return { state: advance({}), listener: null, event: null };
  return { state: { ...state, cycle: state.cycle + 1, tick: 0 }, listener: null, event: null };
}
