import {
  BUCKETS,
  emptyAppHistory,
  emptyServerHistory,
  orgHasBucket,
  queryAppContainers,
  queryAppHistory,
  queryAppSnapshot,
  queryAppSparklines,
  queryAppTraffic,
  queryServerHistory,
  queryServerOomKills,
  queryServerSnapshot,
  type AppContainer,
  type AppHistory,
  type AppSnapshot,
  type AppSparkline,
  type AppTraffic,
  type ServerHistory,
  type ServerSnapshot,
} from "@repo/metrics";
import { EXPECTED_APPS, STALE_AFTER_MS, appRowKey, buildAppRows, hasNoAppData, liveContainers, type AppEnv, type AppRow } from "@/lib/apps-model";

/**
 * Server-side reads for /apps. Everything comes from the Telegraf on the
 * Dokploy server, which writes the host, every container and Traefik's
 * request counters to the webserver bucket every 30 s. Only the prod org has
 * that bucket, so in staging and locally there is nothing to read and the
 * pages say so instead of asking Influx for a bucket it lacks.
 *
 * Every read is on its own: one that fails blanks its own numbers and is
 * named on the page, the rest still shows.
 */

/** Whether this environment's Influx org collects server data at all. */
export const serverDataCollected = () => orgHasBucket(BUCKETS.webserver);

/** The server with its live numbers. */
export interface ServerView {
  snapshot: ServerSnapshot;
  /** No reading for a while: Telegraf or the server is down. */
  stale: boolean;
  /** Null when that read failed. */
  oomKills24h: number | null;
}

export type AppsOverview =
  /** This org has no webserver bucket (staging, dev). */
  | { state: "not-collected" }
  /** Every read failed. */
  | { state: "down" }
  /** The bucket is there and holds nothing recent. */
  | { state: "empty" }
  | { state: "ok"; server: ServerView | null; rows: AppRow[]; failed: string[] };

/** Runs reads side by side and remembers which ones failed. */
function reader() {
  const failed: string[] = [];
  let total = 0;
  const soft = async <T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> => {
    total++;
    try {
      return await run();
    } catch (error) {
      console.error(`[apps ${label}]`, error);
      failed.push(label);
      return fallback;
    }
  };
  return { soft, failed, allFailed: () => total > 0 && failed.length === total };
}

function toServerView(snapshot: ServerSnapshot | null, oomKills24h: number | null, now: number): ServerView | null {
  return snapshot && { snapshot, stale: now - Date.parse(snapshot.time) > STALE_AFTER_MS, oomKills24h };
}

// An hour back, so a server that went quiet still shows (as not reporting)
// instead of the page claiming there never was any data.
const SERVER_RANGE = "1h";

/** Everything the /apps list shows. Never throws. */
export async function getAppsOverview(): Promise<AppsOverview> {
  if (!serverDataCollected()) return { state: "not-collected" };
  const { soft, failed, allFailed } = reader();
  const [snapshot, containers, traffic, sparklines, server, oomKills] = await Promise.all([
    soft("live numbers", () => queryAppSnapshot(), [] as AppSnapshot[]),
    soft("containers", () => queryAppContainers("24h"), [] as AppContainer[]),
    soft("requests", () => queryAppTraffic(), [] as AppTraffic[]),
    soft("trend lines", () => queryAppSparklines("1h", "5m"), [] as AppSparkline[]),
    soft("server", () => queryServerSnapshot(SERVER_RANGE), null),
    soft("OOM kills", () => queryServerOomKills("24h"), null as number | null),
  ]);
  if (allFailed()) return { state: "down" };
  const now = Date.now();
  const rows = buildAppRows({ snapshot, containers, traffic, sparklines }, now);
  if (!server && failed.length === 0 && hasNoAppData(rows)) return { state: "empty" };
  return { state: "ok", server: toServerView(server, oomKills, now), rows, failed };
}

export type AppDetail =
  | { state: "not-collected" }
  | { state: "down" }
  /** Not an expected app, and Telegraf has never seen it. */
  | { state: "unknown" }
  | { state: "ok"; row: AppRow; containers: AppContainer[]; /** Names of the containers that are running right now. */ liveNames: string[]; failed: string[] };

/** One app in one environment, for its detail page. Never throws. */
export async function getApp(env: AppEnv, app: string): Promise<AppDetail> {
  if (!serverDataCollected()) return { state: "not-collected" };
  const { soft, failed, allFailed } = reader();
  const [snapshot, containers, traffic] = await Promise.all([
    soft("live numbers", () => queryAppSnapshot(), [] as AppSnapshot[]),
    soft("containers", () => queryAppContainers("24h", env, app), [] as AppContainer[]),
    soft("requests", () => queryAppTraffic(), [] as AppTraffic[]),
  ]);
  if (allFailed()) return { state: "down" };
  const key = appRowKey(env, app);
  const expected = EXPECTED_APPS.filter((e) => e.env === env && e.app === app);
  const now = Date.now();
  const row = buildAppRows({ snapshot, containers, traffic, sparklines: [] }, now, expected).find((r) => r.key === key);
  if (!row) return { state: "unknown" };
  return { state: "ok", row, containers, liveNames: liveContainers(containers, now).map((c) => c.name), failed };
}

export type ServerDetail = { state: "not-collected" } | { state: "down" } | { state: "empty" } | { state: "ok"; server: ServerView; failed: string[] };

/** The server's live numbers, for its detail page. Never throws. */
export async function getServer(): Promise<ServerDetail> {
  if (!serverDataCollected()) return { state: "not-collected" };
  const { soft, failed } = reader();
  const [snapshot, oomKills] = await Promise.all([
    soft("server", () => queryServerSnapshot(SERVER_RANGE), null),
    soft("OOM kills", () => queryServerOomKills("24h"), null as number | null),
  ]);
  const view = toServerView(snapshot, oomKills, Date.now());
  if (!view) return { state: failed.includes("server") ? "down" : "empty" };
  return { state: "ok", server: view, failed };
}

async function series<T>(label: string, run: () => Promise<T>, empty: T): Promise<T> {
  if (!serverDataCollected()) return empty;
  try {
    return await run();
  } catch (error) {
    console.error(`[apps ${label}]`, error);
    return empty;
  }
}

/** Chart series for one app. Never throws: an Influx failure is empty charts. */
export function fetchAppSeries(env: AppEnv, app: string, range = "24h", window = "1h"): Promise<AppHistory> {
  return series("app history", () => queryAppHistory(env, app, range, window), emptyAppHistory());
}

/** Chart series for the server. Never throws. */
export function fetchServerSeries(range = "24h", window = "1h"): Promise<ServerHistory> {
  return series("server history", () => queryServerHistory(range, window), emptyServerHistory());
}
