import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/core";
import { supabase as supabaseAdmin } from "@repo/supabase";
import {
  getAlertStates,
  upsertAlertStates,
  insertAlertEvents,
  tryAcquireAlertLock,
  releaseAlertLock,
  type AlertState,
  type AlertStateUpsert,
} from "@repo/supabase/queries/alerts";
import { getAlertRuleConfigs } from "@repo/supabase/queries/alert-rule-config";
import { getAlertNotificationConfigs } from "@repo/supabase/queries/alert-notification-config";
import { alertConfig } from "./config";
import { homeEnv } from "./home-env";
import { queryLatestObsNodeFields, queryLatestHostSystemFields } from "@repo/metrics";
import { buildRules } from "./rules";
import { runProbes } from "./probes";
import { computeTransitions } from "./state";
import { dispatchNotifications, resolveRoute, type EnvRoute } from "./notify";
import type { AlertNotification, AlertRule, Breach, Env, EnvContext, Registry, RuleOverrides } from "./types";

const LOCK_NAME = "alerter";
// Above the worst legitimate pass (10s probes + 15s rule timeout + persistence)
// so a running pass is never stolen; low enough that a crashed pass only
// blocks a couple of 15s ticks.
const LOCK_TTL_SECONDS = 35;
const RULE_TIMEOUT_MS = 15_000;

export interface EnvTickSummary {
  env: Env;
  rulesEvaluated: number;
  ruleErrors: number;
  breaches: number;
  fired: number;
  resolved: number;
  notifyFailures: number;
  durationMs: number;
}

export interface TickSummary {
  skipped: boolean;
  reason?: string;
  envs: EnvTickSummary[];
  durationMs: number;
}

// Env resolution lives in ./home-env — web-monitor re-exports it for the
// layout badge, so the UI can never disagree with what the engine evaluates.

/** Services expected to write http_request continuously. ws-server and the
 * web apps don't run metricsMiddleware — their liveness comes from probes. */
const EXPECTED_HTTP_SERVICES = ["rest-api"];

async function loadRegistry(): Promise<Registry> {
  const [obsNodes, ingestNodes, liveSessions, liveChannels] = await Promise.all([
    supabaseAdmin.from("obs_nodes").select("id, name, status, maintenance, created_at, api_url"),
    supabaseAdmin.from("ingest_nodes").select("id, name, status, maintenance, created_at, tailscale_ip"),
    supabaseAdmin.from("ingest_sessions").select("id, started_at").is("ended_at", null),
    supabaseAdmin.from("broadcaster_live_status").select("broadcaster_id", { count: "exact", head: true }).eq("is_live", true),
  ]);
  if (obsNodes.error) throw new Error(`Couldn't load obs_nodes registry: ${obsNodes.error.message}`);
  if (ingestNodes.error) throw new Error(`Couldn't load ingest_nodes registry: ${ingestNodes.error.message}`);
  if (liveSessions.error) throw new Error(`Couldn't load live ingest sessions: ${liveSessions.error.message}`);

  return {
    obsNodes: (obsNodes.data ?? []).map((n) => ({
      id: n.id,
      name: n.name,
      status: n.status,
      maintenance: n.maintenance,
      createdAt: n.created_at,
      apiUrl: n.api_url,
    })),
    ingestNodes: (ingestNodes.data ?? []).map((n) => ({
      id: n.id,
      name: n.name,
      status: n.status,
      maintenance: n.maintenance,
      createdAt: n.created_at,
      tailscaleIp: n.tailscale_ip,
    })),
    services: EXPECTED_HTTP_SERVICES,
    liveIngestSessions: (liveSessions.data ?? []).map((s) => ({ sessionId: s.id, startedAt: s.started_at })),
    anyChannelLive: (liveChannels.count ?? 0) > 0,
  };
}

// In-memory fallback so a Supabase outage degrades alerting instead of
// killing it: the mirror is refreshed on every successful read/write and
// used when Supabase throws. Dedup state survives within the process only —
// after a deploy mid-outage, alerts may re-fire once. Acceptable.
const stateMirror = new Map<Env, Map<string, AlertState>>();

function mirrorKey(row: { rule_id: string; entity_id?: string | null }): string {
  return `${row.rule_id} ${row.entity_id ?? ""}`;
}

function updateMirror(alertEnv: Env, upserts: AlertStateUpsert[], now: Date): void {
  const envMirror = stateMirror.get(alertEnv) ?? new Map<string, AlertState>();
  for (const up of upserts) {
    const prev = envMirror.get(mirrorKey(up));
    envMirror.set(mirrorKey(up), {
      id: prev?.id ?? randomUUID(),
      rule_id: up.rule_id,
      env: up.env,
      entity_id: up.entity_id ?? "",
      status: up.status ?? "ok",
      severity: up.severity ?? null,
      consecutive_breaches: up.consecutive_breaches ?? 0,
      first_fired_at: up.first_fired_at ?? null,
      last_notified_at: up.last_notified_at ?? null,
      silenced_until: up.silenced_until ?? null,
      notify_failed: up.notify_failed ?? false,
      last_value: up.last_value ?? null,
      message: up.message ?? null,
      updated_at: now.toISOString(),
    });
  }
  stateMirror.set(alertEnv, envMirror);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

/** Node entity ids are registry uuids; give notifications the node's name,
 * address, and last-known resource stats so a Discord alert reads like a
 * status card instead of a bare uuid. Fail-soft: stats lookups must never
 * block the notification itself. */
async function enrichNodeNotifications(
  notifications: AlertNotification[],
  registry: Registry,
  bucket: string,
): Promise<void> {
  const findNode = (entityId: string) => {
    const obs = registry.obsNodes.find((x) => x.id === entityId);
    if (obs) return { kind: "obs" as const, name: obs.name, address: obs.apiUrl ?? undefined };
    const ingest = registry.ingestNodes.find((x) => x.id === entityId);
    if (ingest) return { kind: "ingest" as const, name: ingest.name, address: ingest.tailscaleIp ?? undefined };
    return undefined;
  };

  const nodeTargets = notifications
    .map((n) => ({ n, node: n.entityId ? findNode(n.entityId) : undefined }))
    .filter((t): t is { n: AlertNotification; node: NonNullable<ReturnType<typeof findNode>> } => !!t.node);
  if (nodeTargets.length === 0) return;

  // Last samples within the hour — a node that just went silent still shows
  // what it looked like right before it disappeared.
  let obsFields = new Map<string, Record<string, number>>();
  let hostFields = new Map<string, Record<string, number>>();
  try {
    const [obs, hosts] = await Promise.all([
      queryLatestObsNodeFields("1h", { bucket }),
      queryLatestHostSystemFields("1h", { bucket }),
    ]);
    obsFields = new Map(obs.map((x) => [x.nodeId, x.fields]));
    hostFields = new Map(hosts.map((x) => [x.nodeId, x.fields]));
  } catch (err) {
    Sentry.captureException(err, { tags: { stage: "notification-enrichment" } });
  }

  for (const { n, node } of nodeTargets) {
    n.entityLabel = node.address ? `${node.name} (${node.address})` : node.name;
    const f = (node.kind === "obs" ? obsFields : hostFields).get(n.entityId);
    n.node = {
      ...node,
      stats: f
        ? {
            cpuPct: f.cpu_pct,
            memUsedMb: node.kind === "obs" ? f.ram_used_mb : f.mem_used_mb,
            memTotalMb: node.kind === "obs" ? f.ram_total_mb : f.mem_total_mb,
            diskPct: f.disk_used_pct,
            bandwidthMbps:
              node.kind === "ingest" && (f.rx_bytes_per_sec !== undefined || f.tx_bytes_per_sec !== undefined)
                ? (((f.rx_bytes_per_sec ?? 0) + (f.tx_bytes_per_sec ?? 0)) * 8) / 1_000_000
                : undefined,
            gpuTempC: f.gpu_temp_c,
            vramUsedMb: f.vram_used_mb,
            vramTotalMb: f.vram_total_mb,
            runningInstances: f.running_instance_count,
            maxInstances: f.max_instances,
          }
        : undefined,
    };
  }
}

// A fully-down node trips two rules at once: its *_silent absence rule (crit,
// the authoritative "node is gone" signal) and probe.node_unreachable (warn,
// the health-endpoint probe). They answer different questions — the probe
// still fires on its own when a node serves metrics but its health endpoint is
// down — but for a plain node-down they're redundant. Drop the probe breach
// while the node is owned by the crit silence path so an operator gets one
// crit alert, not a warn+crit pair. probe.node_unreachable's forTicks is tuned
// above the silence threshold (see rules.ts) so the probe can't reach its fire
// threshold before this gate engages, which is what keeps it from firing a
// warn and then resolving it seconds later.
const NODE_SILENT_RULE_IDS = ["ingest.node_silent", "obs.node_silent"] as const;

export function suppressRedundantNodeProbes(
  breachesByRule: Map<string, Breach[]>,
  prev: AlertState[],
  registry: Registry,
): void {
  const probeBreaches = breachesByRule.get("probe.node_unreachable");
  if (!probeBreaches || probeBreaches.length === 0) return;

  // Node ids whose silence rule is breaching this tick or already firing.
  const downNodeIds = new Set<string>();
  for (const ruleId of NODE_SILENT_RULE_IDS) {
    for (const b of breachesByRule.get(ruleId) ?? []) downNodeIds.add(b.entityId);
  }
  for (const s of prev) {
    if ((NODE_SILENT_RULE_IDS as readonly string[]).includes(s.rule_id) && s.status === "firing") {
      downNodeIds.add(s.entity_id);
    }
  }
  if (downNodeIds.size === 0) return;

  // Probe ids are `ingest-node:<name>` / `obs-node:<name>`; the silence rules
  // key on the node uuid, so map probe id back to node id via the registry.
  const nodeIdByProbeId = new Map<string, string>();
  for (const n of registry.ingestNodes) nodeIdByProbeId.set(`ingest-node:${n.name}`, n.id);
  for (const n of registry.obsNodes) nodeIdByProbeId.set(`obs-node:${n.name}`, n.id);

  const kept = probeBreaches.filter((b) => {
    const nodeId = nodeIdByProbeId.get(b.entityId);
    return !(nodeId && downNodeIds.has(nodeId));
  });
  if (kept.length === 0) breachesByRule.delete("probe.node_unreachable");
  else breachesByRule.set("probe.node_unreachable", kept);
}

async function evaluateEnv(
  alertEnv: Env,
  bucket: string,
  registry: Registry,
  now: Date,
  overrides: RuleOverrides,
  notifyRoute: EnvRoute,
): Promise<EnvTickSummary> {
  const started = performance.now();
  // Disabled rules skip evaluation but stay in the state machine (zero
  // breaches), so a firing alert resolves cleanly when its rule is turned off.
  const rules = buildRules(overrides).filter((r) => !r.envs || r.envs.includes(alertEnv));
  const activeRules = rules.filter((r) => r.enabled !== false);

  const probeResults = await runProbes(alertEnv, registry);
  const ctx: EnvContext = { env: alertEnv, bucket, now, supabase: supabaseAdmin, registry, probeResults };

  // One broken query must never kill the whole tick.
  const evaluations = await Promise.allSettled(
    activeRules.map((rule: AlertRule) => withTimeout(rule.evaluate(ctx), RULE_TIMEOUT_MS, `rule ${rule.id}`)),
  );
  const breachesByRule = new Map<string, Breach[]>();
  let ruleErrors = 0;
  evaluations.forEach((result, i) => {
    const rule = activeRules[i];
    if (!rule) return;
    if (result.status === "fulfilled") {
      if (result.value.length > 0) breachesByRule.set(rule.id, result.value);
    } else {
      ruleErrors++;
      Sentry.captureException(result.reason, { tags: { alertRule: rule.id, alertEnv } });
    }
  });

  // Load previous state (Supabase, falling back to the in-memory mirror).
  let prev: AlertState[];
  let supabaseHealthy = true;
  try {
    prev = await getAlertStates(supabaseAdmin, alertEnv);
    stateMirror.set(alertEnv, new Map(prev.map((s) => [mirrorKey(s), s])));
  } catch (err) {
    supabaseHealthy = false;
    Sentry.captureException(err, { tags: { alertEnv, stage: "load-state" } });
    prev = [...(stateMirror.get(alertEnv)?.values() ?? [])];
  }

  // Node-down dedup: needs both this tick's breaches and prev firing state.
  suppressRedundantNodeProbes(breachesByRule, prev, registry);

  const { upserts, events, notifications } = computeTransitions(alertEnv, prev, breachesByRule, rules, now);

  updateMirror(alertEnv, upserts, now);
  if (supabaseHealthy) {
    try {
      await upsertAlertStates(supabaseAdmin, upserts);
      await insertAlertEvents(supabaseAdmin, events);
    } catch (err) {
      Sentry.captureException(err, { tags: { alertEnv, stage: "persist-state" } });
    }
  }

  await enrichNodeNotifications(notifications, registry, bucket);

  const { failed } = await dispatchNotifications(notifications, notifyRoute);
  if (failed.length > 0) {
    try {
      await upsertAlertStates(
        supabaseAdmin,
        failed.map((f) => {
          const row = upserts.find((u) => u.rule_id === f.ruleId && (u.entity_id ?? "") === f.entityId);
          return { ...row!, notify_failed: true };
        }),
      );
      await insertAlertEvents(
        supabaseAdmin,
        failed.map((f) => ({
          rule_id: f.ruleId,
          env: alertEnv,
          entity_id: f.entityId,
          event_type: "notify_failed" as const,
          message: "All notification channels failed",
        })),
      );
    } catch (err) {
      Sentry.captureException(err, { tags: { alertEnv, stage: "notify-failed-flag" } });
    }
  }

  return {
    env: alertEnv,
    rulesEvaluated: activeRules.length,
    ruleErrors,
    breaches: [...breachesByRule.values()].reduce((sum, b) => sum + b.length, 0),
    fired: notifications.filter((n) => n.kind === "fired").length,
    resolved: notifications.filter((n) => n.kind === "resolved").length,
    notifyFailures: failed.length,
    durationMs: Math.round(performance.now() - started),
  };
}

export async function runEvaluationPass(): Promise<TickSummary> {
  const started = performance.now();
  const now = new Date();
  const owner = randomUUID();

  // Overlap guard. If Supabase itself is down we run anyway — there's a
  // single ticker in practice, and a dead lock table must not silence alerts.
  let lockHeld = false;
  try {
    lockHeld = await tryAcquireAlertLock(supabaseAdmin, LOCK_NAME, LOCK_TTL_SECONDS, owner);
    if (!lockHeld) {
      return { skipped: true, reason: "another evaluation pass holds the lock", envs: [], durationMs: 0 };
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { stage: "acquire-lock" } });
  }

  try {
    let registry: Registry = {
      obsNodes: [],
      ingestNodes: [],
      services: EXPECTED_HTTP_SERVICES,
      liveIngestSessions: [],
      anyChannelLive: false,
    };
    try {
      registry = await loadRegistry();
    } catch (err) {
      Sentry.captureException(err, { tags: { stage: "load-registry" } });
    }

    // Admin threshold overrides — fail open to code defaults so a config-read
    // outage can never stop alerting.
    let overrides: RuleOverrides = {};
    try {
      const rows = await getAlertRuleConfigs(supabaseAdmin);
      overrides = Object.fromEntries(
        rows.map((row) => [
          row.rule_id,
          {
            enabled: row.enabled,
            warn: row.warn,
            crit: row.crit,
            forTicks: row.for_ticks,
            envs: row.envs as Env[] | null,
          },
        ]),
      );
    } catch (err) {
      Sentry.captureException(err, { tags: { stage: "load-rule-config" } });
    }

    // Notification routing — same fail-open policy.
    let notifyRoute = resolveRoute(homeEnv());
    try {
      const rows = await getAlertNotificationConfigs(supabaseAdmin);
      notifyRoute = resolveRoute(homeEnv(), rows.find((r) => r.env === homeEnv()) ?? null);
    } catch (err) {
      Sentry.captureException(err, { tags: { stage: "load-notification-config" } });
    }

    const summary = await evaluateEnv(homeEnv(), alertConfig.influxdbBucket, registry, now, overrides, notifyRoute);
    return { skipped: false, envs: [summary], durationMs: Math.round(performance.now() - started) };
  } finally {
    if (lockHeld) {
      try {
        await releaseAlertLock(supabaseAdmin, LOCK_NAME, owner);
      } catch (err) {
        Sentry.captureException(err, { tags: { stage: "release-lock" } });
      }
    }
  }
}
