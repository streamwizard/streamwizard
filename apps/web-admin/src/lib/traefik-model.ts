import type { TraefikSparkline } from "@repo/metrics";
import { isTraefikScope, meanMs, sharePct, slowPct, totalRates, type TraefikAppStats, type TraefikRates, type TraefikScope, type TraefikStatusCount } from "@repo/metrics/traefik-model";
import type { AppEnv } from "@/lib/apps-model";

// The /traefik page's logic, kept free of server imports so it can be
// unit-tested: how Traefik's per-app rates become the page's totals, its app
// rows and its error rows. The maths on the rates themselves is shared with
// the readers: @repo/metrics/traefik-model.

export type { TraefikScope };

/** The environment the page opens on. */
export const DEFAULT_SCOPE: TraefikScope = "prod";

/** Filter order on the page. */
export const SCOPES = ["prod", "staging", "shared", "other", "all"] as const satisfies readonly TraefikScope[];

export const SCOPE_LABEL: Record<TraefikScope, string> = {
  prod: "Production",
  staging: "Staging",
  shared: "Shared",
  other: "Other",
  all: "All",
};

/** The `?env=` value of a request. Anything unknown is the default. */
export function parseScope(value: string | string[] | undefined): TraefikScope {
  return typeof value === "string" && isTraefikScope(value) ? value : DEFAULT_SCOPE;
}

const inScope = (scope: TraefikScope) => (row: { env: string }) => scope === "all" || row.env === scope;

/** What the page shows of a set of rates. Percentages are null without requests. */
export interface TraefikFigures {
  requestsPerSec: number;
  /** Share of the answers with a 5xx status. */
  serverErrorPct: number | null;
  /** Share of the answers with a 4xx status. */
  clientErrorPct: number | null;
  /** Share of the HTTP requests that took longer than 1.2 s. */
  slowPct: number | null;
  meanMs: number | null;
  bytesInPerSec: number;
  bytesOutPerSec: number;
}

function figures(rates: TraefikRates): TraefikFigures {
  return {
    requestsPerSec: rates.requestsPerSec,
    serverErrorPct: sharePct(rates.serverErrorsPerSec, rates.requestsPerSec),
    clientErrorPct: sharePct(rates.clientErrorsPerSec, rates.requestsPerSec),
    slowPct: slowPct(rates.httpWithin),
    meanMs: meanMs(rates),
    bytesInPerSec: rates.bytesInPerSec,
    bytesOutPerSec: rates.bytesOutPerSec,
  };
}

/** The headline numbers of a scope: its apps added up first, shares taken after. */
export function scopeTotals(stats: readonly TraefikAppStats[], scope: TraefikScope): TraefikFigures {
  return figures(totalRates(stats.filter(inScope(scope))));
}

/** Plain, serializable row for the app table. */
export interface TraefikRow extends TraefikFigures {
  key: string;
  app: string;
  env: AppEnv;
  /** Requests per second over the last hour, oldest first. */
  sparkline: number[];
}

/** The rest of the server is somebody else's: it never leads the list. */
const ours = (row: { env: string }) => row.env !== "other";

/** Worst first: 5xx share, then slow share, then the busiest. Null sorts last. */
function byTrouble(a: TraefikRow, b: TraefikRow): number {
  return (
    Number(ours(b)) - Number(ours(a)) ||
    (b.serverErrorPct ?? -1) - (a.serverErrorPct ?? -1) ||
    (b.slowPct ?? -1) - (a.slowPct ?? -1) ||
    b.requestsPerSec - a.requestsPerSec ||
    a.app.localeCompare(b.app)
  );
}

/** One row per app Traefik routes to in the scope, the one that needs a look on top. */
export function buildTraefikRows(stats: readonly TraefikAppStats[], sparklines: readonly TraefikSparkline[], scope: TraefikScope): TraefikRow[] {
  const sparks = new Map(sparklines.map((s) => [s.key, s.requests]));
  return stats
    .filter(inScope(scope))
    .map((app) => ({ key: app.key, app: app.app, env: app.env as AppEnv, sparkline: sparks.get(app.key) ?? [], ...figures(app) }))
    .sort(byTrouble);
}

// --- Errors by app and status code ---

export interface ErrorRow {
  id: string;
  app: string;
  env: AppEnv;
  code: string;
  count: number;
  /** This code as a share of everything the app answered in the range. */
  sharePct: number | null;
}

const isError = (code: string) => /^[45]\d\d$/.test(code);

/** The 4xx and 5xx answers per app and code, most frequent first. */
export function buildErrorRows(counts: readonly TraefikStatusCount[], limit = 20): ErrorRow[] {
  const answered = new Map<string, number>();
  for (const c of counts) answered.set(c.key, (answered.get(c.key) ?? 0) + c.count);
  return counts
    .filter((c) => isError(c.code) && Math.round(c.count) > 0)
    .map((c) => ({ id: `${c.key}:${c.code}`, app: c.app, env: c.env as AppEnv, code: c.code, count: Math.round(c.count), sharePct: sharePct(c.count, answered.get(c.key) ?? 0) }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .slice(0, limit);
}

const STATUS_MEANING: Record<string, string> = {
  "400": "Bad request",
  "401": "Not signed in",
  "403": "Not allowed",
  "404": "Not found",
  "405": "Method not allowed",
  "408": "Request timed out",
  "409": "Conflict",
  "413": "Request too large",
  "422": "Invalid input",
  "429": "Rate limited",
  "499": "Client hung up",
  "500": "App error",
  "502": "App did not answer",
  "503": "No app to send it to",
  "504": "App took too long",
};

/** A few words on what a status code means here. Empty for the rare ones. */
export const statusMeaning = (code: string): string => STATUS_MEANING[code] ?? "";
