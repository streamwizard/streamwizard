import {
  emptyTraefikHistory,
  emptyTraefikProxyHistory,
  queryTraefikApps,
  queryTraefikHistory,
  queryTraefikProxyHistory,
  queryTraefikProxySnapshot,
  queryTraefikSparklines,
  queryTraefikStatusCounts,
  type TraefikAppStats,
  type TraefikHistory,
  type TraefikProxyHistory,
  type TraefikSparkline,
  type TraefikStatusCount,
} from "@repo/metrics";
import { serverDataCollected } from "@/lib/apps";
import { softReader } from "@/lib/soft-reader";
import { buildErrorRows, buildTraefikRows, scopeTotals, type ErrorRow, type TraefikFigures, type TraefikRow, type TraefikScope } from "@/lib/traefik-model";

/**
 * Server-side reads for /traefik: what Traefik itself counts about the
 * requests it passes on. Telegraf scrapes it every 30 s into the webserver
 * bucket, which only the prod org has (see lib/apps.ts).
 *
 * Every read is on its own: one that fails blanks its own numbers and is
 * named on the page, the rest still shows.
 */

export type TraefikOverview =
  /** This org has no webserver bucket (staging, dev). */
  | { state: "not-collected" }
  /** Every read failed. */
  | { state: "down" }
  /** The bucket is there and holds nothing recent from Traefik. */
  | { state: "empty" }
  | {
      state: "ok";
      /** Null when the read behind it failed. */
      totals: TraefikFigures | null;
      rows: TraefikRow[];
      /** The whole proxy, whatever the scope. Null when that read failed. */
      openConnections: number | null;
      failed: string[];
    };

/** The live numbers of one scope: the last 5 minutes. Never throws. */
export async function getTraefikOverview(scope: TraefikScope): Promise<TraefikOverview> {
  if (!serverDataCollected()) return { state: "not-collected" };
  const { soft, failed, allFailed } = softReader("traefik");
  const [stats, sparklines, proxy] = await Promise.all([
    soft("requests", () => queryTraefikApps(), null as TraefikAppStats[] | null),
    soft("trend lines", () => queryTraefikSparklines("1h", "5m"), [] as TraefikSparkline[]),
    soft("open connections", () => queryTraefikProxySnapshot(), null),
  ]);
  if (allFailed()) return { state: "down" };
  if (failed.length === 0 && stats?.length === 0 && !proxy) return { state: "empty" };
  return {
    state: "ok",
    totals: stats && scopeTotals(stats, scope),
    rows: buildTraefikRows(stats ?? [], sparklines, scope),
    openConnections: proxy?.openConnections ?? null,
    failed,
  };
}

/** Everything that follows the header's range: the charts and the error table. */
export interface TraefikSeries extends TraefikHistory, TraefikProxyHistory {
  errors: ErrorRow[];
}

/** Chart series and error rows of one scope. Never throws: an Influx failure is empty charts. */
export async function fetchTraefikSeries(scope: TraefikScope, range = "24h", window = "1h"): Promise<TraefikSeries> {
  const read = async <T>(label: string, run: () => Promise<T>, empty: T): Promise<T> => {
    if (!serverDataCollected()) return empty;
    try {
      return await run();
    } catch (error) {
      console.error(`[traefik ${label}]`, error);
      return empty;
    }
  };
  const [history, proxy, counts] = await Promise.all([
    read("history", () => queryTraefikHistory(scope, range, window), emptyTraefikHistory()),
    read("proxy history", () => queryTraefikProxyHistory(range, window), emptyTraefikProxyHistory()),
    read("status codes", () => queryTraefikStatusCounts(scope, range), [] as TraefikStatusCount[]),
  ]);
  return { ...history, ...proxy, errors: buildErrorRows(counts) };
}
