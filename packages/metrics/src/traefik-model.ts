// The maths behind web-admin's /traefik page, free of server imports so the
// page's client components and the unit tests can use it. The readers that
// fill these shapes are in queries/traefik-queries.ts.

/** One environment, or every app on the server. */
export const TRAEFIK_SCOPES = ["prod", "staging", "shared", "other", "all"] as const;
export type TraefikScope = (typeof TRAEFIK_SCOPES)[number];

export function isTraefikScope(value: string): value is TraefikScope {
  return (TRAEFIK_SCOPES as readonly string[]).includes(value);
}

/**
 * Per-second rates of one app, or of several added up. Kept as rates (not as
 * percentages) so rows can be summed into a total first.
 */
export interface TraefikRates {
  requestsPerSec: number;
  /** Answers with a 4xx status. */
  clientErrorsPerSec: number;
  /** Answers with a 5xx status. */
  serverErrorsPerSec: number;
  bytesInPerSec: number;
  bytesOutPerSec: number;
  /** Seconds of response time per second, over `timedPerSec` requests. */
  durationPerSec: number;
  timedPerSec: number;
  /**
   * HTTP requests per second answered within each histogram step, keyed by
   * the step ("0.1", "0.3", …, "+Inf"). Cumulative, as Traefik counts them.
   * WebSocket and SSE are left out: they stay open for minutes.
   */
  httpWithin: Record<string, number>;
}

/** The rates of one app in one environment. */
export interface TraefikAppStats extends TraefikRates {
  key: string;
  app: string;
  env: string;
}

export const emptyRates = (): TraefikRates => ({
  requestsPerSec: 0,
  clientErrorsPerSec: 0,
  serverErrorsPerSec: 0,
  bytesInPerSec: 0,
  bytesOutPerSec: 0,
  durationPerSec: 0,
  timedPerSec: 0,
  httpWithin: {},
});

/** Adds up rows, for the totals of a scope. */
export function totalRates(rows: readonly TraefikRates[]): TraefikRates {
  const total = emptyRates();
  for (const row of rows) {
    total.requestsPerSec += row.requestsPerSec;
    total.clientErrorsPerSec += row.clientErrorsPerSec;
    total.serverErrorsPerSec += row.serverErrorsPerSec;
    total.bytesInPerSec += row.bytesInPerSec;
    total.bytesOutPerSec += row.bytesOutPerSec;
    total.durationPerSec += row.durationPerSec;
    total.timedPerSec += row.timedPerSec;
    for (const [step, value] of Object.entries(row.httpWithin)) total.httpWithin[step] = (total.httpWithin[step] ?? 0) + value;
  }
  return total;
}

/** `part` as a percentage of `whole`. Null without a whole. */
export const sharePct = (part: number, whole: number): number | null => (whole > 0 ? (part / whole) * 100 : null);

/** Mean time Traefik waited for an answer, in ms. Null without requests. */
export const meanMs = (rates: Pick<TraefikRates, "durationPerSec" | "timedPerSec">): number | null =>
  rates.timedPerSec > 0 ? (rates.durationPerSec / rates.timedPerSec) * 1000 : null;

/** "2xx" … "5xx". Anything else (0 is a hijacked WebSocket) is "other". */
export type StatusClass = "1xx" | "2xx" | "3xx" | "4xx" | "5xx" | "other";

export function statusClass(code: string | undefined): StatusClass {
  return code && /^[1-5]\d\d$/.test(code) ? (`${code.charAt(0)}xx` as StatusClass) : "other";
}

// --- Speed bands ---

/** A request that takes longer than this counts as slow. One of Traefik's histogram steps. */
export const SLOW_AFTER_SECONDS = 1.2;

const NO_LIMIT = "+Inf";

/** The histogram's steps as numbers, fastest first. The open-ended one is Infinity. */
function sortedSteps(steps: readonly string[]): { step: string; upTo: number }[] {
  return steps
    .map((step) => ({ step, upTo: step === NO_LIMIT ? Infinity : Number(step) }))
    .filter((s) => !Number.isNaN(s.upTo))
    .sort((a, b) => a.upTo - b.upTo);
}

const seconds = (value: number) => `${value} s`;

function bandLabel(from: number, upTo: number): string {
  if (from === 0) return `Under ${seconds(upTo)}`;
  if (upTo === Infinity) return `Over ${seconds(from)}`;
  return `${from} to ${seconds(upTo)}`;
}

/** Band names for a set of histogram steps, fastest first: "Under 0.1 s", "0.1 to 0.3 s", …, "Over 5 s". */
export function speedBandLabels(steps: readonly string[]): string[] {
  let from = 0;
  return sortedSteps(steps).map(({ upTo }) => {
    const label = bandLabel(from, upTo);
    from = upTo;
    return label;
  });
}

export interface SpeedBand {
  label: string;
  /** Share of the requests that landed in this band, 0 to 100. */
  share: number;
}

/**
 * Turns Traefik's cumulative histogram ("answered within 0.3 s" includes
 * "within 0.1 s") into the share per band. Empty without requests.
 */
export function speedBands(within: Record<string, number>): SpeedBand[] {
  const steps = sortedSteps(Object.keys(within));
  const total = within[NO_LIMIT] ?? 0;
  if (!(total > 0)) return [];
  const labels = speedBandLabels(Object.keys(within));
  let below = 0;
  return steps.map(({ step }, i) => {
    // The steps are rates averaged per series, so they can be off by a hair:
    // never above the total, never below the step before.
    const upToHere = Math.max(below, Math.min(within[step] ?? 0, total));
    const band = { label: labels[i]!, share: ((upToHere - below) / total) * 100 };
    below = upToHere;
    return band;
  });
}

/** Share of the HTTP requests that took longer than `after` seconds, 0 to 100. Null without requests or without that step. */
export function slowPct(within: Record<string, number>, after = SLOW_AFTER_SECONDS): number | null {
  const total = within[NO_LIMIT] ?? 0;
  const step = Object.keys(within).find((s) => Number(s) === after);
  if (!(total > 0) || step === undefined) return null;
  return (1 - Math.min(within[step]!, total) / total) * 100;
}

// --- Status codes ---

/** How often one app answered with one status code in a range. */
export interface TraefikStatusCount {
  key: string;
  app: string;
  env: string;
  code: string;
  count: number;
}
