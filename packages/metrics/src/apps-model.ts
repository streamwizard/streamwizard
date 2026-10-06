import type { AppContainer, AppEnv } from "./queries/webserver-queries";

// What the /apps pages and the app.* alert rules agree on: which apps belong on
// the Dokploy server, and how a container's state reads. Types only above, so
// client components can import this file.

const MONOREPO_APPS = [
  "rest-api",
  "ws-server",
  "web-streamwizard",
  "web-overlay",
  "web-admin",
  "streamwizard-bot",
  "discord-bot",
  "obs-auto-switcher",
  "alert-worker",
];

// One instance of these serves both environments.
const SHARED_APPS = ["traefik", "influxdb", "dokploy", "dokploy-postgres", "dokploy-redis", "host-telegraf"];

/**
 * Apps that should be on the server. The names are the app tags Telegraf
 * writes (telegraf repo, host/apps.star): add an app there and here.
 */
export const EXPECTED_APPS: readonly { env: AppEnv; app: string }[] = [
  ...MONOREPO_APPS.map((app) => ({ env: "prod" as const, app })),
  ...MONOREPO_APPS.map((app) => ({ env: "staging" as const, app })),
  ...SHARED_APPS.map((app) => ({ env: "shared" as const, app })),
];

/** Telegraf writes every 30 s. After this long without a reading the numbers
 * are old, and a container that was running counts as gone. */
export const STALE_AFTER_MS = 120_000;

// 0 is a clean stop, 143 is SIGTERM: what Docker sends the old container on a deploy.
const NORMAL_EXIT_CODES = new Set([0, 143]);

const isRecent = (iso: string | null | undefined, now: number, withinMs: number) => !!iso && now - Date.parse(iso) <= withinMs;

/** A stop that is not a clean exit. */
export function isFailedExit(c: Pick<AppContainer, "state" | "exitCode" | "oomKilled">): boolean {
  if (c.state === "running") return false;
  return c.oomKilled || (c.exitCode !== null && !NORMAL_EXIT_CODES.has(c.exitCode));
}

/** Containers that are running and still being reported. */
export function liveContainers(containers: AppContainer[], now: number): AppContainer[] {
  return containers.filter((c) => c.state === "running" && isRecent(c.lastSeen, now, STALE_AFTER_MS));
}

type Lifetime = Pick<AppContainer, "name" | "startedAt" | "finishedAt">;

/**
 * True when a deploy stopped this container. Updates are start-first: the
 * replacement is already running when the old container is told to stop, so
 * a younger container of the same app started before this one ended. A crash
 * is the other way around: the replacement starts after the end.
 *
 * The exit code cannot tell the two apart. A container that is slow to stop
 * is killed after Docker's grace period and leaves 137 on a normal deploy.
 */
export function isDeployStop(c: Lifetime, siblings: readonly Lifetime[]): boolean {
  const { startedAt, finishedAt } = c;
  if (!startedAt || !finishedAt) return false;
  return siblings.some((s) => s.name !== c.name && !!s.startedAt && s.startedAt > startedAt && s.startedAt <= finishedAt);
}

/** Containers of one app that stopped within the window, and not for a deploy. */
export function unplannedStops(containers: AppContainer[], now: number, withinMs: number): AppContainer[] {
  return containers.filter((c) => c.state !== "running" && isRecent(c.finishedAt, now, withinMs) && !isDeployStop(c, containers));
}
