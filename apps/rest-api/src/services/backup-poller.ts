import { hostname } from "node:os";
import type { BackupPollData, PbsData, PveHostData, SourceHealth } from "@repo/backups";
import { reportError } from "@repo/sentry";
import { supabase, type Json } from "@repo/supabase";
import { claimBackupPoll, saveBackupPollState } from "@repo/supabase/queries/backups";
import { backupConfig, type BackupConfig } from "../lib/backup-config";
import { fetchPbs, fetchPve, type SourceResult } from "../lib/backup-sources";
import { loadBackupPoll, reconcileUnmatchedEvents } from "../lib/backup-store";
import { createProxmoxClient, pbsAuthorization, pveAuthorization } from "../lib/proxmox-client";

/**
 * Polls PBS and the PVE hosts into backup_poll_state (docs/backup-monitoring-plan.md).
 * Webhooks tell us fast when a job finishes; this is what notices when one
 * never ran, and it's the only source for snapshot, verify and GC state.
 */

/** Let the process settle before the first pass. */
const FIRST_POLL_DELAY_MS = 30 * 1000;

/** An on-demand poll (webhook, refresh button) is allowed this soon after the last one. */
const FORCED_MIN_INTERVAL_SECONDS = 60;

export interface BackupPollerDeps {
  datastore: string;
  namespace: string;
  intervalSeconds: number;
  /** Returns true when this replica may poll now. */
  claim: (minIntervalSeconds: number) => Promise<boolean>;
  load: () => Promise<BackupPollData | null>;
  save: (data: BackupPollData) => Promise<void>;
  fetchPbs: (prev: PbsData | null) => Promise<SourceResult<PbsData>>;
  /** One fetcher per configured PVE host, keyed by host name. */
  fetchPve: Record<string, (prev: PveHostData | null) => Promise<SourceResult<PveHostData>>>;
  /** Runs after a saved pass, e.g. to settle webhook events that waited for discovery. */
  afterPoll?: (data: BackupPollData) => Promise<void>;
  now?: () => Date;
}

export type PollResult = { polled: false } | { polled: true; data: BackupPollData };

const EMPTY_HEALTH: SourceHealth = { okAt: null, attemptAt: null, error: null, failingSince: null };

export function nextHealth(prev: SourceHealth | undefined, nowIso: string, outcome: { ok: true; warnings: string[] } | { ok: false; error: string }): SourceHealth {
  if (outcome.ok) {
    return { okAt: nowIso, attemptAt: nowIso, error: outcome.warnings.length ? outcome.warnings.join("; ") : null, failingSince: null };
  }
  return {
    okAt: prev?.okAt ?? null,
    attemptAt: nowIso,
    error: outcome.error,
    failingSince: prev?.failingSince ?? nowIso,
  };
}

export function createBackupPoller(deps: BackupPollerDeps) {
  const now = deps.now ?? (() => new Date());
  let timer: ReturnType<typeof setInterval> | null = null;
  let soonTimer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<PollResult> | null = null;

  async function runPoll(force: boolean): Promise<PollResult> {
    // Slightly under the interval, so replica timer drift can't skip a round.
    const minInterval = force ? FORCED_MIN_INTERVAL_SECONDS : Math.max(FORCED_MIN_INTERVAL_SECONDS, deps.intervalSeconds - 10);
    if (!(await deps.claim(minInterval))) return { polled: false };

    const prev = await deps.load();
    const nowDate = now();
    const nowIso = nowDate.toISOString();

    const hosts = Object.keys(deps.fetchPve);
    const [pbsResult, ...pveResults] = await Promise.allSettled([
      deps.fetchPbs(prev?.pbs.data ?? null),
      ...hosts.map((name) => deps.fetchPve[name]!(prev?.pve[name]?.data ?? null)),
    ]);

    const data: BackupPollData = {
      version: 1,
      datastore: deps.datastore,
      namespace: deps.namespace,
      pbs:
        pbsResult!.status === "fulfilled"
          ? { data: pbsResult!.value.data, health: nextHealth(prev?.pbs.health, nowIso, { ok: true, warnings: pbsResult!.value.warnings }) }
          : { data: prev?.pbs.data ?? null, health: nextHealth(prev?.pbs.health ?? EMPTY_HEALTH, nowIso, { ok: false, error: (pbsResult!.reason as Error).message }) },
      pve: {},
    };
    hosts.forEach((name, i) => {
      const result = pveResults[i]!;
      const prevHost = prev?.pve[name];
      data.pve[name] =
        result.status === "fulfilled"
          ? { data: result.value.data, health: nextHealth(prevHost?.health, nowIso, { ok: true, warnings: result.value.warnings }) }
          : { data: prevHost?.data ?? null, health: nextHealth(prevHost?.health, nowIso, { ok: false, error: (result.reason as Error).message }) };
    });

    await deps.save(data);
    if (deps.afterPoll) {
      await deps.afterPoll(data).catch((error) => reportError(error, "backup-poller: after poll"));
    }

    const failed = [
      ...(data.pbs.health.okAt === nowIso ? [] : ["pbs"]),
      ...hosts.filter((h) => data.pve[h]!.health.okAt !== nowIso),
    ];
    // Unreachable sources are expected (a host reboot, Tailscale blips) and
    // raise their own alert; a log line is enough here, no Sentry event.
    if (failed.length) console.warn(`[backup-poller] poll done, unreachable: ${failed.join(", ")}`);
    else console.log(`[backup-poller] poll done, ${data.pbs.data?.snapshots.length ?? 0} snapshots, ${hosts.length} hosts`);
    return { polled: true, data };
  }

  /** One pass. `force` lowers the claim window for on-demand polls. */
  function poll(opts: { force?: boolean } = {}): Promise<PollResult> {
    if (inFlight) return inFlight;
    inFlight = runPoll(Boolean(opts.force)).finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  const run = (force: boolean) =>
    poll({ force }).catch((error) => {
      reportError(error, "backup-poller: poll");
    });

  /** Debounced on-demand poll, for "a webhook just arrived". */
  function pollSoon(delayMs = 60_000): void {
    if (soonTimer) return;
    soonTimer = setTimeout(() => {
      soonTimer = null;
      void run(true);
    }, delayMs);
    soonTimer.unref?.();
  }

  function start(): void {
    if (timer) return;
    setTimeout(() => void run(false), FIRST_POLL_DELAY_MS).unref?.();
    timer = setInterval(() => void run(false), deps.intervalSeconds * 1000);
    timer.unref?.();
  }

  function stop(): void {
    if (timer) clearInterval(timer);
    if (soonTimer) clearTimeout(soonTimer);
    timer = null;
    soonTimer = null;
  }

  return { poll, pollSoon, start, stop };
}

export type BackupPoller = ReturnType<typeof createBackupPoller>;

function buildPoller(config: BackupConfig): BackupPoller {
  const owner = `${hostname()}:${process.pid}`;
  const pbsClient = createProxmoxClient({
    baseUrl: config.pbs.url,
    authorization: pbsAuthorization(config.pbs.tokenId, config.pbs.tokenSecret),
    label: "pbs",
  });
  const fetchPveByHost = Object.fromEntries(
    config.pveHosts.map((host) => {
      const client = createProxmoxClient({ baseUrl: host.url, authorization: pveAuthorization(host.tokenId, host.tokenSecret), label: host.name });
      return [host.name, (prev: PveHostData | null) => fetchPve(client, config.datastore, config.namespace, prev, Date.now() / 1000)];
    }),
  );

  return createBackupPoller({
    datastore: config.datastore,
    namespace: config.namespace,
    intervalSeconds: config.pollSeconds,
    claim: (minInterval) => claimBackupPoll(supabase, config.pollId, minInterval, owner),
    load: () => loadBackupPoll(config.pollId),
    save: (data) => saveBackupPollState(supabase, config.pollId, data as unknown as Json),
    fetchPbs: (prev) => fetchPbs(pbsClient, config.datastore, config.namespace, prev),
    fetchPve: fetchPveByHost,
    afterPoll: async (data) => {
      const { matched, dropped } = await reconcileUnmatchedEvents(data);
      if (matched || dropped) console.log(`[backup-poller] webhook events: ${matched} matched, ${dropped} dropped`);
    },
  });
}

/** Null when the Proxmox env vars aren't set (every env but prod). */
export const backupPoller: BackupPoller | null = backupConfig ? buildPoller(backupConfig) : null;
