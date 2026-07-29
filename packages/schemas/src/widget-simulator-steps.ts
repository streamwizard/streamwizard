import type { OverlayGeoEvent } from "./streamwizard";
import { WIDGET_TEST_EVENTS } from "./widget-test-events";

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
