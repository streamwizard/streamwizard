import {
  computeBackupOverview,
  type BackupEventGuest,
  type BackupEventLite,
  type BackupOverview,
  type BackupPollData,
  type BackupVmIssueCode,
} from "@repo/backups";
import { listBackupEventsSince } from "@repo/supabase/queries/backups";
import type { AlertRule, Breach, EnvContext, RuleOverrides } from "../types";
import { customRule } from "./builders";
import {
  BACKUP_DATASTORE_CRIT_PCT,
  BACKUP_DATASTORE_WARN_PCT,
  BACKUP_SOURCE_STALE_MIN,
  BACKUP_STALE_CRIT_HOURS,
  BACKUP_STALE_WARN_HOURS,
} from "./thresholds";

/**
 * Proxmox backup rules (docs/backup-monitoring-plan.md). rest-api's poller and
 * webhook receiver write backup_poll_state / backup_events; these rules read
 * them and reuse the same status function as the /backups page, so the page
 * and /alerts never disagree. No poll row at all means monitoring isn't set
 * up in this env, and every rule stays quiet.
 */

const EVENT_WINDOW_MS = 8 * 24 * 60 * 60 * 1000;

/**
 * The poll row and events only change every 5 minutes (or on a webhook), but
 * the engine ticks every 15 s. Re-reading them each tick cost ~2-3 GB of
 * Supabase egress a month, so the raw rows are kept for 3 minutes per env.
 * The overview itself is recomputed every tick against ctx.now, so ages and
 * "not polled for 15 min" stay exact; only fresh data can lag by <=3 min.
 */
const RAW_TTL_MS = 3 * 60 * 1000;

interface RawBackupState {
  poll: BackupPollData;
  events: BackupEventLite[];
}

const rawByEnv = new Map<string, { loadedAt: number; value: Promise<RawBackupState | null> }>();

/** Tests only: forget cached rows between cases. */
export function resetBackupRuleCache(): void {
  rawByEnv.clear();
}

async function loadRaw(ctx: EnvContext): Promise<RawBackupState | null> {
  const { data, error } = await ctx.supabase.from("backup_poll_state").select("data");
  if (error) throw new Error(`Couldn't load backup poll state: ${error.message}`);
  const poll = data.map((row) => row.data as unknown as BackupPollData).find((d) => d?.version === 1);
  if (!poll) return null;

  const rows = await listBackupEventsSince(ctx.supabase, new Date(ctx.now.getTime() - EVENT_WINDOW_MS).toISOString());
  const events = rows.map((row) => ({
    id: row.id,
    source: row.source,
    eventType: row.event_type,
    jobId: row.job_id,
    severity: row.severity,
    title: row.title,
    occurredAt: row.occurred_at,
    receivedAt: row.received_at,
    guests: (row.guests as BackupEventGuest[] | null) ?? null,
  }));
  return { poll, events };
}

function raw(ctx: EnvContext): Promise<RawBackupState | null> {
  const cached = rawByEnv.get(ctx.env);
  if (cached && ctx.now.getTime() - cached.loadedAt < RAW_TTL_MS) return cached.value;
  const value = loadRaw(ctx);
  rawByEnv.set(ctx.env, { loadedAt: ctx.now.getTime(), value });
  // A failed load must not be served for 3 minutes.
  value.catch(() => rawByEnv.delete(ctx.env));
  return value;
}

// Every rule in a tick shares one computed overview (the engine hands all
// rules the same ctx).
const overviewByTick = new WeakMap<EnvContext, Promise<BackupOverview | null>>();

function overview(ctx: EnvContext): Promise<BackupOverview | null> {
  let pending = overviewByTick.get(ctx);
  if (!pending) {
    pending = raw(ctx).then((r) => (r ? computeBackupOverview(r.poll, r.events, ctx.now) : null));
    overviewByTick.set(ctx, pending);
  }
  return pending;
}

const vmLabel = (vm: { vmid: number; name: string | null }) => (vm.name ? `${vm.name} (${vm.vmid})` : `VM ${vm.vmid}`);

/** One crit breach per VM that has an issue with this code. */
function issueRule(id: string, title: string, code: BackupVmIssueCode, overrides: RuleOverrides): AlertRule {
  return customRule(
    {
      id,
      title,
      forTicks: 2,
      envs: ["prod"],
      async evaluate(ctx) {
        const o = await overview(ctx);
        if (!o) return [];
        return o.vms.flatMap((vm) => {
          const issue = vm.issues.find((i) => i.code === code);
          return issue ? [{ entityId: String(vm.vmid), severity: "crit" as const, message: `${vmLabel(vm)}: ${issue.message}` }] : [];
        });
      },
    },
    overrides,
  );
}

export function backupRules(overrides: RuleOverrides): AlertRule[] {
  return [
    customRule(
      {
        id: "backup.vm_stale",
        title: "Backup too old",
        forTicks: 2,
        envs: ["prod"],
        warn: { default: BACKUP_STALE_WARN_HOURS, unit: "h", direction: "above" },
        crit: { default: BACKUP_STALE_CRIT_HOURS, unit: "h", direction: "above" },
        async evaluate(ctx, t) {
          const o = await overview(ctx);
          if (!o) return [];
          const breaches: Breach[] = [];
          for (const vm of o.vms) {
            if (vm.ageSeconds === null) continue;
            const hours = vm.ageSeconds / 3600;
            if (hours <= t.warn && hours <= t.crit) continue;
            breaches.push({
              entityId: String(vm.vmid),
              severity: hours > t.crit ? "crit" : "warn",
              value: Math.round(hours),
              message: `${vmLabel(vm)}: newest backup is ${Math.round(hours)} h old`,
            });
          }
          return breaches;
        },
      },
      overrides,
    ),
    issueRule("backup.vm_failed", "Backup run failed", "run_failed", overrides),
    issueRule("backup.verify_failed", "Backup failed verification", "verify_failed", overrides),
    issueRule("backup.job_disabled", "Backup job disabled", "job_disabled", overrides),
    customRule(
      {
        id: "backup.datastore_usage",
        title: "Backup datastore filling up",
        forTicks: 2,
        envs: ["prod"],
        warn: { default: BACKUP_DATASTORE_WARN_PCT, unit: "%", direction: "above" },
        crit: { default: BACKUP_DATASTORE_CRIT_PCT, unit: "%", direction: "above" },
        async evaluate(ctx, t) {
          const o = await overview(ctx);
          if (!o?.usage) return [];
          const pct = o.usage.usedPct;
          if (pct < t.warn && pct < t.crit) return [];
          return [
            {
              entityId: o.datastore,
              severity: pct >= t.crit ? "crit" : "warn",
              value: pct,
              message: `PBS datastore ${o.datastore} is ${pct.toFixed(1)}% full`,
            },
          ];
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "backup.pbs_jobs",
        title: "PBS maintenance job failed or overdue",
        forTicks: 2,
        envs: ["prod"],
        async evaluate(ctx) {
          const o = await overview(ctx);
          if (!o) return [];
          const jobs = [...(o.jobs.gc ? [o.jobs.gc] : []), ...o.jobs.prune, ...o.jobs.verify];
          return jobs
            .filter((j) => j.status === "error" || j.status === "warning")
            .map((j) => ({
              entityId: `${j.kind}:${j.id}`,
              severity: j.status === "error" ? ("crit" as const) : ("warn" as const),
              message:
                j.state === "error"
                  ? `PBS ${j.kind} job ${j.id} failed: ${j.stateText ?? "unknown error"}`
                  : `PBS ${j.kind} job ${j.id} last ran ${j.lastRunAt ?? "never"}`,
            }));
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "backup.source_unreachable",
        title: "Backup monitoring can't reach Proxmox",
        forTicks: 2,
        envs: ["prod"],
        crit: { default: BACKUP_SOURCE_STALE_MIN, unit: "min", direction: "above" },
        async evaluate(ctx, t) {
          const o = await overview(ctx);
          if (!o) return [];
          const sources = [{ name: "pbs", health: o.pbs.health }, ...o.hosts.map((h) => ({ name: h.name, health: h.health }))];
          const breaches: Breach[] = [];
          for (const { name, health } of sources) {
            const silentMin = health.okAt ? (ctx.now.getTime() - Date.parse(health.okAt)) / 60_000 : Infinity;
            if (silentMin <= t.crit) continue;
            breaches.push({
              entityId: name,
              severity: "crit",
              value: Number.isFinite(silentMin) ? Math.round(silentMin) : undefined,
              message: `${name} API not polled successfully ${health.okAt ? `for ${Math.round(silentMin)} min` : "yet"}${health.error ? `: ${health.error}` : ""}`,
            });
          }
          return breaches;
        },
      },
      overrides,
    ),
  ];
}
