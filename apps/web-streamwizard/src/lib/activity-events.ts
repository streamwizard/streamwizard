import type { EventMap } from "@repo/posthog";

/*
 * The events a browser may report through POST /api/activity, each with the
 * function that rebuilds its properties from untrusted input.
 *
 * Most account actions are recorded by the server action that performs them.
 * These are the ones with no server action behind them: copying a link,
 * playing a clip, a browser calling another service directly. The browser has
 * to say they happened, so the server only accepts the names listed here and
 * only the properties each sanitiser lets through. Anything else is refused,
 * not passed on.
 *
 * No server imports: the browser helper types against this file too.
 */

type Input = Record<string, unknown>;

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const NAME = /^[a-z][a-z0-9_.:-]{0,63}$/;

function text(value: unknown, pattern: RegExp): string | null {
  return typeof value === "string" && pattern.test(value) ? value : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return allowed.find((candidate) => candidate === value) ?? null;
}

function wholeNumber(value: unknown, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max ? value : null;
}

const OBS_LOCATIONS = ["dashboard", "deck"] as const;

function obsLocation(input: Input): { location: (typeof OBS_LOCATIONS)[number] } | null {
  const location = oneOf(input.location, OBS_LOCATIONS);
  return location ? { location } : null;
}

export const RELAYED_EVENTS = {
  overlay_url_copied: (input) => {
    const overlay_id = text(input.overlay_id, ID);
    const location = oneOf(input.location, ["create_dialog", "card", "editor"] as const);
    return overlay_id && location ? { overlay_id, location } : null;
  },
  cloud_obs_started: obsLocation,
  cloud_obs_stopped: obsLocation,
  clip_played: () => ({}),
  clip_link_copied: () => ({}),
  onboarding_started: () => ({}),
  onboarding_step_completed: (input) => {
    const step_id = text(input.step_id, NAME);
    const step_index = wholeNumber(input.step_index, 50);
    const total_steps = wholeNumber(input.total_steps, 50);
    return step_id && step_index !== null && total_steps !== null ? { step_id, step_index, total_steps } : null;
  },
  test_alert_fired: (input) => {
    const event_type = text(input.event_type, NAME);
    const mode = oneOf(input.mode, ["local", "live"] as const);
    return event_type && mode ? { event_type, mode } : null;
  },
  deck_scene_switched: (input) => (typeof input.held === "boolean" ? { held: input.held } : null),
  clips_filtered: (input) => {
    if (!Array.isArray(input.filters)) return null;
    const filters = [...new Set(input.filters.map((key) => text(key, NAME)).filter((key) => key !== null))];
    return filters.length > 0 && filters.length <= 20 ? { filters } : null;
  },
} satisfies { [E in keyof EventMap]?: (input: Input) => EventMap[E] | null };

export type RelayedEvent = keyof typeof RELAYED_EVENTS;

// hasOwn, not `in`: "constructor" and "toString" are not events.
export function isRelayedEvent(name: unknown): name is RelayedEvent {
  return typeof name === "string" && Object.hasOwn(RELAYED_EVENTS, name);
}
