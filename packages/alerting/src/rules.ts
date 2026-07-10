import {
  queryLatestObsNodeFields,
  queryLatestHostSystemFields,
  queryIngestStreamActivity,
  queryHttpErrorRateByService,
  queryHttpP95ByService,
  queryLastWriteByTag,
  queryBucketPointCount,
  queryWsEventTotal,
  queryDbQueryErrorRate,
  queryEventsubLastEvent,
  querySupabaseDbCpuPct,
  querySupabaseDbDiskPct,
  querySupabaseDbConnections,
  querySupabaseMaxConnections,
  querySupabaseLastScrape,
  type PlatformPoint,
  type QueryOpts,
} from "@repo/metrics";
import { checkSslExpiry } from "./probes";
import type { AlertRule, Breach, Env, EnvContext, RuleKnob, RuleOverrides, Severity } from "./types";

// The rule catalog (monitoring plan v2.2 §4). The constants below are CODE
// DEFAULTS; admins can override warn/crit/forTicks/envs/enabled per rule via
// the alert_rule_config table (edited on /alerts/rules), which the engine
// passes into buildRules() on every tick. Query logic and rule identity stay
// here — only the numbers are database-tunable.

// --- Default thresholds ---
export const GPU_TEMP_WARN_C = 83;
export const GPU_TEMP_CRIT_C = 90;
export const VRAM_USED_WARN_PCT = 92;
export const NVENC_FPS_LOW = 28;
export const NODE_CPU_WARN_PCT = 90;
export const NODE_RAM_WARN_PCT = 92;
export const INGEST_BANDWIDTH_WARN_PCT = 80;
/** NIC capacity assumed for ingest boxes until it's self-reported. */
export const INGEST_NIC_CAPACITY_MBPS = 1000;
export const API_5XX_RATE_PCT = 5;
export const API_5XX_MIN_REQUESTS = 20;
export const API_P95_WARN_MS = 1500;
export const WS_AUTH_FAILURE_SPIKE = 30;
export const DB_ERROR_RATE_PCT = 5;
export const DB_ERROR_MIN_QUERIES = 20;
export const DISK_WARN_PCT = 85;
export const DISK_CRIT_PCT = 95;
export const SSL_WARN_DAYS = 14;
export const SSL_CRIT_DAYS = 3;
export const SUPABASE_DB_CPU_WARN_PCT = 80;
export const SUPABASE_DB_CPU_CRIT_PCT = 95;
export const SUPABASE_DB_CONN_WARN_PCT = 80;
export const SUPABASE_DB_CONN_CRIT_PCT = 95;
export const SUPABASE_DB_DISK_WARN_PCT = 80;
export const SUPABASE_DB_DISK_CRIT_PCT = 90;
export const SUPABASE_SCRAPE_SILENT_MIN = 10;
/** Node agents write every 10s; 45s (4.5 missed samples) is decisively dead
 * without false-firing on a single hiccup. */
export const NODE_SILENT_AFTER_MS = 45 * 1000;
export const SERVICE_SILENT_AFTER_MIN = 5;
export const EVENTSUB_SILENCE_MIN = 30;
export const INGEST_STALL_MIN_SESSION_AGE_MS = 2 * 60 * 1000;

// --- Rule constructors ---
// Each takes the full overrides record and resolves its own row by opts.id:
// effective value = override ?? code default. meta carries the defaults and
// units so the rules UI can render inputs without duplicating this file.

interface ThresholdSample {
  entityId: string;
  value: number;
}

function thresholdRule(
  opts: {
    id: string;
    title: string;
    forTicks: number;
    envs?: Env[];
    fetch: (ctx: EnvContext) => Promise<ThresholdSample[]>;
    warn?: number;
    crit?: number;
    direction?: "above" | "below";
    /** Unit label for the rules UI (e.g. "%", "°C", "ms"). */
    unit?: string;
    /** false = thresholds are structural (not meaningful to edit) — the UI
     * hides them and overrides are ignored. */
    tunable?: boolean;
    format: (entityId: string, value: number, t: { warn?: number; crit?: number }) => string;
  },
  overrides: RuleOverrides,
): AlertRule {
  const o = overrides[opts.id] ?? {};
  const direction = opts.direction ?? "above";
  const tunable = opts.tunable ?? true;
  const warn = (tunable ? o.warn : null) ?? opts.warn;
  const crit = (tunable ? o.crit : null) ?? opts.crit;
  const t = { warn, crit };
  return {
    id: opts.id,
    title: opts.title,
    envs: o.envs ?? opts.envs,
    forTicks: o.forTicks ?? opts.forTicks,
    enabled: o.enabled ?? true,
    meta: {
      warn: tunable && opts.warn !== undefined ? { default: opts.warn, unit: opts.unit ?? "", direction } : undefined,
      crit: tunable && opts.crit !== undefined ? { default: opts.crit, unit: opts.unit ?? "", direction } : undefined,
      defaultForTicks: opts.forTicks,
      defaultEnvs: opts.envs,
    },
    async evaluate(ctx) {
      const samples = await opts.fetch(ctx);
      const breaches: Breach[] = [];
      for (const sample of samples) {
        const breachesCrit =
          crit !== undefined && (direction === "above" ? sample.value > crit : sample.value < crit);
        const breachesWarn =
          warn !== undefined && (direction === "above" ? sample.value > warn : sample.value < warn);
        if (!breachesCrit && !breachesWarn) continue;
        breaches.push({
          entityId: sample.entityId,
          severity: breachesCrit ? "crit" : "warn",
          value: sample.value,
          message: opts.format(sample.entityId, sample.value, t),
        });
      }
      return breaches;
    },
  };
}

function absenceRule(
  opts: {
    id: string;
    title: string;
    measurement: string;
    tag: string;
    /** Registry entities expected to be writing. entityId is the stable
     * state key (node uuid); label is what humans see in alert messages. */
    expected: (ctx: EnvContext) => { entityId: string; label?: string }[];
    silentAfterMs: number;
  },
  overrides: RuleOverrides,
): AlertRule {
  const o = overrides[opts.id] ?? {};
  const defaultEnvs: Env[] = ["prod", "staging"]; // absence detection is disabled for dev
  // The tunable knob is exposed in minutes (crit column), stored default is ms.
  const silentAfterMs = o.crit != null ? o.crit * 60_000 : opts.silentAfterMs;
  return {
    id: opts.id,
    title: opts.title,
    envs: o.envs ?? defaultEnvs,
    forTicks: o.forTicks ?? 2,
    enabled: o.enabled ?? true,
    meta: {
      crit: { default: opts.silentAfterMs / 60_000, unit: "min", direction: "above" },
      defaultForTicks: 2,
      defaultEnvs,
    },
    async evaluate(ctx) {
      const lastWrites = await queryLastWriteByTag(opts.measurement, opts.tag, "24h", { bucket: ctx.bucket });
      const lastSeenByEntity = new Map(lastWrites.map((w) => [w.tagValue, new Date(w.lastSeen).getTime()]));
      const breaches: Breach[] = [];
      for (const entity of opts.expected(ctx)) {
        const lastSeen = lastSeenByEntity.get(entity.entityId);
        // 24h prior-report requirement: an entity that never wrote in the
        // last day is a provisioning problem, not a fresh outage. This also
        // keeps freshly registered nodes quiet until their first report.
        if (lastSeen === undefined) continue;
        const silentForMs = ctx.now.getTime() - lastSeen;
        if (silentForMs < silentAfterMs) continue;
        breaches.push({
          entityId: entity.entityId,
          severity: "crit",
          value: Math.round(silentForMs / 1000),
          message: `${opts.title}: ${entity.label ?? entity.entityId} last reported ${Math.round(silentForMs / 60000)}m ago`,
        });
      }
      return breaches;
    },
  };
}

function probeRule(
  opts: {
    id: string;
    title: string;
    forTicks: number;
    envs?: Env[];
    /** Which probe results this rule owns. */
    match: (probeId: string) => boolean;
    severity: (probeId: string, env: Env) => Severity;
  },
  overrides: RuleOverrides,
): AlertRule {
  const o = overrides[opts.id] ?? {};
  return {
    id: opts.id,
    title: opts.title,
    envs: o.envs ?? opts.envs,
    forTicks: o.forTicks ?? opts.forTicks,
    enabled: o.enabled ?? true,
    meta: { defaultForTicks: opts.forTicks, defaultEnvs: opts.envs },
    async evaluate(ctx) {
      const breaches: Breach[] = [];
      for (const probe of ctx.probeResults.values()) {
        if (!opts.match(probe.id) || probe.ok) continue;
        breaches.push({
          entityId: probe.id,
          severity: opts.severity(probe.id, ctx.env),
          value: probe.statusCode,
          message: `Probe ${probe.id} failed: ${probe.statusCode ?? probe.error ?? "unknown error"}`,
        });
      }
      return breaches;
    },
  };
}

/** Rules with bespoke evaluate logic still get override resolution and knob
 * metadata; evaluate receives the effective thresholds as `t`. */
function customRule(
  opts: {
    id: string;
    title: string;
    forTicks: number;
    envs?: Env[];
    warn?: RuleKnob;
    crit?: RuleKnob;
    evaluate: (ctx: EnvContext, t: { warn: number; crit: number }) => Promise<Breach[]>;
  },
  overrides: RuleOverrides,
): AlertRule {
  const o = overrides[opts.id] ?? {};
  const t = {
    warn: o.warn ?? opts.warn?.default ?? NaN,
    crit: o.crit ?? opts.crit?.default ?? NaN,
  };
  return {
    id: opts.id,
    title: opts.title,
    envs: o.envs ?? opts.envs,
    forTicks: o.forTicks ?? opts.forTicks,
    enabled: o.enabled ?? true,
    meta: { warn: opts.warn, crit: opts.crit, defaultForTicks: opts.forTicks, defaultEnvs: opts.envs },
    evaluate: (ctx) => opts.evaluate(ctx, t),
  };
}

// --- Fetch helpers shared by threshold rules ---

/** Latest value of a Supabase platform series as a single "supabase" entity;
 * empty when Telegraf hasn't written the series recently. */
async function supabaseLatest(
  query: (fluxRange: string, window: string, opts?: QueryOpts) => Promise<PlatformPoint[]>,
  ctx: EnvContext,
): Promise<ThresholdSample[]> {
  const series = await query("15m", "5m", { bucket: ctx.bucket });
  const latest = series.at(-1);
  return latest === undefined ? [] : [{ entityId: "supabase", value: latest.value }];
}

async function obsNodeField(
  ctx: EnvContext,
  pick: (fields: Record<string, number>) => number | undefined,
): Promise<ThresholdSample[]> {
  const nodes = await queryLatestObsNodeFields("10m", { bucket: ctx.bucket });
  return nodes.flatMap((node) => {
    const value = pick(node.fields);
    return value === undefined || Number.isNaN(value) ? [] : [{ entityId: node.nodeId, value }];
  });
}

async function hostSystemField(
  ctx: EnvContext,
  pick: (fields: Record<string, number>) => number | undefined,
): Promise<ThresholdSample[]> {
  const hosts = await queryLatestHostSystemFields("10m", { bucket: ctx.bucket });
  return hosts.flatMap((host) => {
    const value = pick(host.fields);
    return value === undefined || Number.isNaN(value) ? [] : [{ entityId: host.nodeId, value }];
  });
}

const pct = (used?: number, total?: number): number | undefined =>
  used !== undefined && total !== undefined && total > 0 ? (used / total) * 100 : undefined;

// --- The catalog ---

export function buildRules(overrides: RuleOverrides = {}): AlertRule[] {
  return [
    // GPU / OBS nodes
    thresholdRule(
      {
        id: "gpu.temp_high",
        title: "GPU temperature high",
        forTicks: 2,
        warn: GPU_TEMP_WARN_C,
        unit: "°C",
        fetch: (ctx) => obsNodeField(ctx, (f) => f.gpu_temp_c),
        format: (node, v, t) => `GPU on ${node} at ${v.toFixed(0)}°C (warn > ${t.warn}°C)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "gpu.temp_crit",
        title: "GPU temperature critical",
        forTicks: 1,
        crit: GPU_TEMP_CRIT_C,
        unit: "°C",
        fetch: (ctx) => obsNodeField(ctx, (f) => f.gpu_temp_c),
        format: (node, v, t) => `GPU on ${node} at ${v.toFixed(0)}°C (crit > ${t.crit}°C)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "gpu.vram_headroom",
        title: "VRAM nearly full",
        forTicks: 2,
        warn: VRAM_USED_WARN_PCT,
        unit: "%",
        fetch: (ctx) => obsNodeField(ctx, (f) => pct(f.vram_used_mb, f.vram_total_mb)),
        format: (node, v, t) => `VRAM on ${node} at ${v.toFixed(1)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "gpu.nvenc_fps_low",
        title: "NVENC encode FPS low",
        forTicks: 2,
        crit: NVENC_FPS_LOW,
        direction: "below",
        unit: "fps",
        // Gate on active encode sessions: an idle (non-streaming) instance uses
        // no NVENC and averageFps reads 0, which would false-fire permanently.
        fetch: (ctx) =>
          obsNodeField(ctx, (f) => ((f.nvenc_sessions ?? 0) > 0 ? f.nvenc_avg_fps : undefined)),
        format: (node, v, t) =>
          `NVENC on ${node} averaging ${v.toFixed(1)} fps with active sessions (crit < ${t.crit})`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "gpu.nvenc_capacity",
        title: "NVENC encoder slots exhausted",
        forTicks: 2,
        warn: 0,
        tunable: false, // value is a structural margin, not a real threshold
        // Value is sessions minus cap: > 0-threshold means at/over capacity.
        fetch: (ctx) =>
          obsNodeField(ctx, (f) =>
            f.max_encoder_sessions !== undefined && f.max_encoder_sessions > 0 && f.nvenc_sessions !== undefined
              ? f.nvenc_sessions - f.max_encoder_sessions + 1
              : undefined,
          ),
        format: (node) => `All NVENC encoder slots on ${node} are in use`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "obs.node_cpu",
        title: "OBS node CPU high",
        forTicks: 2,
        warn: NODE_CPU_WARN_PCT,
        unit: "%",
        fetch: (ctx) => obsNodeField(ctx, (f) => f.cpu_pct),
        format: (node, v, t) => `CPU on ${node} at ${v.toFixed(1)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "obs.node_ram",
        title: "OBS node RAM high",
        forTicks: 2,
        warn: NODE_RAM_WARN_PCT,
        unit: "%",
        fetch: (ctx) => obsNodeField(ctx, (f) => pct(f.ram_used_mb, f.ram_total_mb)),
        format: (node, v, t) => `RAM on ${node} at ${v.toFixed(1)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    customRule(
      {
        id: "obs.capacity_full",
        title: "OBS fleet at container capacity",
        forTicks: 2,
        async evaluate(ctx) {
          const nodes = await queryLatestObsNodeFields("10m", { bucket: ctx.bucket });
          let running = 0;
          let max = 0;
          for (const node of nodes) {
            running += node.fields.running_instance_count ?? 0;
            max += node.fields.max_instances ?? 0;
          }
          if (max === 0 || running < max) return [];
          return [
            {
              entityId: "",
              severity: "warn",
              value: running,
              message: `OBS fleet is full: ${running}/${max} container slots in use`,
            },
          ];
        },
      },
      overrides,
    ),
    absenceRule(
      {
        id: "obs.node_silent",
        title: "OBS node gone silent",
        measurement: "obs_node",
        tag: "node_id",
        silentAfterMs: NODE_SILENT_AFTER_MS,
        expected: (ctx) =>
          ctx.registry.obsNodes
            .filter((n) => n.status === "linked" && !n.maintenance)
            .map((n) => ({ entityId: n.id, label: n.apiUrl ? `${n.name} (${n.apiUrl})` : n.name })),
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "obs.disk_full",
        title: "OBS node disk filling up",
        forTicks: 2,
        warn: DISK_WARN_PCT,
        crit: DISK_CRIT_PCT,
        unit: "%",
        fetch: (ctx) => obsNodeField(ctx, (f) => f.disk_used_pct),
        format: (node, v, t) => `Disk on ${node} at ${v.toFixed(1)}% (warn > ${t.warn}%, crit > ${t.crit}%)`,
      },
      overrides,
    ),

    // Ingest boxes
    thresholdRule(
      {
        id: "ingest.host_cpu",
        title: "Ingest host CPU high",
        forTicks: 2,
        warn: NODE_CPU_WARN_PCT,
        unit: "%",
        fetch: (ctx) => hostSystemField(ctx, (f) => f.cpu_pct),
        format: (node, v, t) => `CPU on ${node} at ${v.toFixed(1)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "ingest.host_mem",
        title: "Ingest host memory high",
        forTicks: 2,
        warn: NODE_RAM_WARN_PCT,
        unit: "%",
        fetch: (ctx) => hostSystemField(ctx, (f) => pct(f.mem_used_mb, f.mem_total_mb)),
        format: (node, v, t) => `Memory on ${node} at ${v.toFixed(1)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "ingest.bandwidth",
        title: "Ingest host bandwidth saturating",
        forTicks: 3,
        warn: INGEST_BANDWIDTH_WARN_PCT,
        unit: "%",
        fetch: (ctx) =>
          hostSystemField(ctx, (f) => {
            const totalBytesPerSec = (f.rx_bytes_per_sec ?? 0) + (f.tx_bytes_per_sec ?? 0);
            const mbps = (totalBytesPerSec * 8) / 1_000_000;
            return (mbps / INGEST_NIC_CAPACITY_MBPS) * 100;
          }),
        format: (node, v, t) =>
          `Bandwidth on ${node} at ${v.toFixed(1)}% of ${INGEST_NIC_CAPACITY_MBPS} Mbps (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "ingest.disk_full",
        title: "Ingest host disk filling up",
        forTicks: 2,
        warn: DISK_WARN_PCT,
        crit: DISK_CRIT_PCT,
        unit: "%",
        fetch: (ctx) => hostSystemField(ctx, (f) => f.disk_used_pct),
        format: (node, v, t) => `Disk on ${node} at ${v.toFixed(1)}% (warn > ${t.warn}%, crit > ${t.crit}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "ingest.ws_broadcast_down",
        title: "Ingest node WS broadcast link down",
        // ~45s sustained at the 15s tick — rides out the client's normal
        // reconnect backoff (caps at 30s) without flapping.
        forTicks: 3,
        warn: 1,
        direction: "below",
        // The field is 0/1 and only written by nodes that have WS broadcast
        // configured, so absence (old node version / WS disabled) stays quiet.
        tunable: false,
        fetch: (ctx) => hostSystemField(ctx, (f) => f.ws_broadcast_connected),
        format: (node) => `WS broadcast link from ${node} to ws-server is down`,
      },
      overrides,
    ),
    absenceRule(
      {
        id: "ingest.node_silent",
        title: "Ingest node gone silent",
        measurement: "host_system",
        tag: "node_id",
        silentAfterMs: NODE_SILENT_AFTER_MS,
        expected: (ctx) =>
          ctx.registry.ingestNodes
            .filter((n) => n.status === "linked" && !n.maintenance)
            .map((n) => ({ entityId: n.id, label: n.tailscaleIp ? `${n.name} (${n.tailscaleIp})` : n.name })),
      },
      overrides,
    ),
    customRule(
      {
        id: "ingest.stream_stall",
        title: "Ingest stream stalled",
        forTicks: 2,
        envs: ["prod", "staging"],
        async evaluate(ctx) {
          if (ctx.registry.liveIngestSessions.length === 0) return [];
          const activity = await queryIngestStreamActivity("2m", { bucket: ctx.bucket });
          const activeSessionIds = new Set(activity.filter((a) => a.kbps > 0).map((a) => a.sessionId));
          const breaches: Breach[] = [];
          for (const session of ctx.registry.liveIngestSessions) {
            // Skip sessions that just started — first samples may still be in flight.
            if (ctx.now.getTime() - new Date(session.startedAt).getTime() < INGEST_STALL_MIN_SESSION_AGE_MS)
              continue;
            if (activeSessionIds.has(session.sessionId)) continue;
            breaches.push({
              entityId: session.sessionId,
              severity: "crit",
              message: `Session ${session.sessionId} is live in the DB but no bytes are flowing`,
            });
          }
          return breaches;
        },
      },
      overrides,
    ),

    // Application plane
    customRule(
      {
        id: "api.5xx_rate",
        title: "HTTP 5xx error rate high",
        forTicks: 1,
        crit: { default: API_5XX_RATE_PCT, unit: "%", direction: "above" },
        async evaluate(ctx, t) {
          const services = await queryHttpErrorRateByService("5m", { bucket: ctx.bucket });
          const breaches: Breach[] = [];
          for (const svc of services) {
            if (svc.total < API_5XX_MIN_REQUESTS) continue;
            const rate = (svc.errors5xx / svc.total) * 100;
            if (rate <= t.crit) continue;
            breaches.push({
              entityId: svc.service,
              severity: "crit",
              value: rate,
              message: `${svc.service} returning ${rate.toFixed(1)}% 5xx (${svc.errors5xx}/${svc.total} in 5m)`,
            });
          }
          return breaches;
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "api.p95_latency",
        title: "HTTP p95 latency high",
        forTicks: 2,
        warn: { default: API_P95_WARN_MS, unit: "ms", direction: "above" },
        async evaluate(ctx, t) {
          const services = await queryHttpP95ByService("10m", { bucket: ctx.bucket });
          return services
            .filter((svc) => svc.p95Ms > t.warn)
            .map((svc) => ({
              entityId: svc.service,
              severity: "warn" as const,
              value: svc.p95Ms,
              message: `${svc.service} p95 latency ${svc.p95Ms.toFixed(0)}ms over 10m (warn > ${t.warn}ms)`,
            }));
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "api.service_silent",
        title: "Service stopped reporting requests",
        forTicks: 2,
        envs: ["prod", "staging"],
        warn: { default: SERVICE_SILENT_AFTER_MIN, unit: "min", direction: "above" },
        async evaluate(ctx, t) {
          const lastWrites = await queryLastWriteByTag("http_request", "service", "24h", { bucket: ctx.bucket });
          const lastSeenByService = new Map(lastWrites.map((w) => [w.tagValue, new Date(w.lastSeen).getTime()]));
          const breaches: Breach[] = [];
          for (const service of ctx.registry.services) {
            const lastSeen = lastSeenByService.get(service);
            if (lastSeen === undefined) continue; // never wrote in 24h — provisioning, not an outage
            const silentForMs = ctx.now.getTime() - lastSeen;
            if (silentForMs < t.warn * 60_000) continue;
            // Escalate when the black-box probe agrees the service is down.
            const probeAlsoFailing = ctx.probeResults.get(service)?.ok === false;
            breaches.push({
              entityId: service,
              severity: probeAlsoFailing ? "crit" : "warn",
              value: Math.round(silentForMs / 1000),
              message: `${service} hasn't written http_request for ${Math.round(silentForMs / 60000)}m${probeAlsoFailing ? " and its health probe is failing" : ""}`,
            });
          }
          return breaches;
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "eventsub.silence",
        title: "EventSub pipeline silent while channels are live",
        forTicks: 1,
        envs: ["prod", "staging"],
        crit: { default: EVENTSUB_SILENCE_MIN, unit: "min", direction: "above" },
        async evaluate(ctx, t) {
          if (!ctx.registry.anyChannelLive) return [];
          // Query range tracks the threshold so a raised limit still finds the last event.
          const rangeMin = Math.max(30, Math.ceil(t.crit));
          const lastEvent = await queryEventsubLastEvent(`${rangeMin}m`, { bucket: ctx.bucket });
          if (lastEvent && ctx.now.getTime() - new Date(lastEvent).getTime() < t.crit * 60_000) return [];
          return [
            {
              entityId: "",
              severity: "crit",
              message: `No EventSub events received in ${Math.round(t.crit)}m while at least one tracked channel is live`,
            },
          ];
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "ws.auth_failure_spike",
        title: "WebSocket auth failures spiking",
        forTicks: 1,
        warn: { default: WS_AUTH_FAILURE_SPIKE, unit: "count / 5m", direction: "above" },
        async evaluate(ctx, t) {
          const count = await queryWsEventTotal("ws_auth_failure", "5m", { bucket: ctx.bucket });
          if (count <= t.warn) return [];
          return [
            {
              entityId: "",
              severity: "warn",
              value: count,
              message: `${count} WebSocket auth failures in 5m (warn > ${t.warn})`,
            },
          ];
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "ws.message_drops",
        title: "WebSocket messages malformed",
        forTicks: 1,
        warn: { default: 0, unit: "count / 5m", direction: "above" },
        async evaluate(ctx, t) {
          // room_not_found is excluded on purpose: a bot broadcast for a user
          // with no open dashboard/overlay is normal operation (ingest stats
          // arrive every second whether or not anyone subscribed), so counting
          // it here made every unwatched stream page an operator. What's left
          // — malformed payloads — always indicates a protocol bug or version
          // skew between a bot client and ws-server, so the threshold stays 0.
          const count = await queryWsEventTotal("ws_message_drop", "5m", { bucket: ctx.bucket }, ["room_not_found"]);
          if (count <= t.warn) return [];
          return [
            {
              entityId: "",
              severity: "warn",
              value: count,
              message: `${count} malformed WebSocket messages dropped in 5m`,
            },
          ];
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "db.query_error_rate",
        title: "Supabase query error rate high",
        forTicks: 2,
        crit: { default: DB_ERROR_RATE_PCT, unit: "%", direction: "above" },
        async evaluate(ctx, t) {
          const { total, errors } = await queryDbQueryErrorRate("5m", { bucket: ctx.bucket });
          if (total < DB_ERROR_MIN_QUERIES) return [];
          const rate = (errors / total) * 100;
          if (rate <= t.crit) return [];
          return [
            {
              entityId: "",
              severity: "crit",
              value: rate,
              message: `${rate.toFixed(1)}% of Supabase queries failing (${errors}/${total} in 5m)`,
            },
          ];
        },
      },
      overrides,
    ),

    // Meta
    customRule(
      {
        id: "meta.pipeline_silent",
        title: "Metrics pipeline silent",
        forTicks: 2,
        envs: ["prod"],
        async evaluate(ctx) {
          const points = await queryBucketPointCount("5m", { bucket: ctx.bucket });
          if (points > 0) return [];
          return [
            {
              entityId: "",
              severity: "crit",
              value: 0,
              message: `No points written to ${ctx.bucket} in 5m — the whole metrics write path is down`,
            },
          ];
        },
      },
      overrides,
    ),
    // Supabase platform (rules 25–28) — data comes from Telegraf scraping the
    // per-project privileged metrics endpoint. When Telegraf hasn't written
    // recently the fetchers return no samples, so these stay quiet instead of
    // false-firing; scrape_silent is what notices that condition.
    thresholdRule(
      {
        id: "supabase.db_cpu",
        title: "Supabase DB CPU high",
        forTicks: 3,
        warn: SUPABASE_DB_CPU_WARN_PCT,
        crit: SUPABASE_DB_CPU_CRIT_PCT,
        unit: "%",
        fetch: (ctx) => supabaseLatest(querySupabaseDbCpuPct, ctx),
        format: (_e, v, t) => `Supabase DB CPU at ${v.toFixed(0)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "supabase.connections",
        title: "Supabase connections near limit",
        forTicks: 2,
        warn: SUPABASE_DB_CONN_WARN_PCT,
        crit: SUPABASE_DB_CONN_CRIT_PCT,
        unit: "%",
        fetch: async (ctx) => {
          const [series, max] = await Promise.all([
            querySupabaseDbConnections("15m", "5m", { bucket: ctx.bucket }),
            querySupabaseMaxConnections({ bucket: ctx.bucket }),
          ]);
          const latest = series.at(-1);
          if (latest === undefined || max === null || max === 0) return [];
          return [{ entityId: "supabase", value: (latest.value / max) * 100 }];
        },
        format: (_e, v, t) => `Supabase at ${v.toFixed(0)}% of max_connections (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "supabase.db_disk",
        title: "Supabase DB disk filling",
        forTicks: 2,
        warn: SUPABASE_DB_DISK_WARN_PCT,
        crit: SUPABASE_DB_DISK_CRIT_PCT,
        unit: "%",
        fetch: (ctx) => supabaseLatest(querySupabaseDbDiskPct, ctx),
        format: (_e, v, t) => `Supabase DB disk at ${v.toFixed(0)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    customRule(
      {
        id: "supabase.scrape_silent",
        title: "Supabase metrics scrape silent",
        forTicks: 2,
        envs: ["prod", "staging"],
        warn: { default: SUPABASE_SCRAPE_SILENT_MIN, unit: "min", direction: "above" },
        async evaluate(ctx, t) {
          const lastScrape = await querySupabaseLastScrape({ bucket: ctx.bucket });
          // Never scraped in 24h = Telegraf not set up for this env yet — a
          // provisioning gap, not an outage (same policy as the absence rules).
          if (lastScrape === null) return [];
          const silentForMs = ctx.now.getTime() - new Date(lastScrape).getTime();
          if (silentForMs < t.warn * 60_000) return [];
          return [
            {
              entityId: "supabase",
              severity: "warn",
              value: Math.round(silentForMs / 1000),
              message: `Supabase platform metrics last scraped ${Math.round(silentForMs / 60000)}m ago — DB rules are blind`,
            },
          ];
        },
      },
      overrides,
    ),

    // Probes
    probeRule(
      {
        id: "probe.fail",
        title: "Black-box probe failing",
        forTicks: 2,
        match: (id) => !id.startsWith("obs-node:") && !id.startsWith("ingest-node:"),
        severity: (_id, alertEnv) => (alertEnv === "prod" ? "crit" : "warn"),
      },
      overrides,
    ),
    probeRule(
      {
        id: "probe.node_unreachable",
        title: "Node health endpoint unreachable",
        // Deliberately slower than the *_silent absence rules (NODE_SILENT_AFTER_MS
        // = 45s): at 15s/tick this fires at 60s, after silence starts breaching,
        // so a fully-down node is caught by the crit silence path and the engine
        // suppresses this probe before it fires (see suppressRedundantNodeProbes).
        // A node that serves metrics but whose health endpoint is down still
        // fires here — just ~30s later than before.
        forTicks: 4,
        envs: ["prod", "staging"],
        match: (id) => id.startsWith("obs-node:") || id.startsWith("ingest-node:"),
        severity: () => "warn", // the *_silent absence rules own the crit path
      },
      overrides,
    ),
    customRule(
      {
        id: "probe.ssl_expiry",
        title: "TLS certificate expiring",
        forTicks: 1,
        envs: ["prod"],
        warn: { default: SSL_WARN_DAYS, unit: "days", direction: "below" },
        crit: { default: SSL_CRIT_DAYS, unit: "days", direction: "below" },
        async evaluate(ctx, t) {
          const certs = await checkSslExpiry(ctx.now);
          const breaches: Breach[] = [];
          for (const cert of certs) {
            if (cert.daysRemaining >= t.warn) continue;
            breaches.push({
              entityId: cert.hostname,
              severity: cert.daysRemaining < t.crit ? "crit" : "warn",
              value: cert.daysRemaining,
              message: `Certificate for ${cert.hostname} expires in ${cert.daysRemaining.toFixed(1)} days`,
            });
          }
          return breaches;
        },
      },
      overrides,
    ),
  ];
}

// --- Serializable catalog for the rules UI ---

const RULE_GROUPS: Record<string, string> = {
  gpu: "OBS / GPU nodes",
  obs: "OBS / GPU nodes",
  ingest: "Ingest nodes",
  api: "HTTP / API",
  eventsub: "EventSub",
  ws: "WebSocket",
  db: "Database",
  supabase: "Supabase platform",
  meta: "Meta",
  probe: "Probes",
};

export interface RuleCatalogEntry {
  id: string;
  title: string;
  group: string;
  defaultForTicks: number;
  defaultEnvs: Env[];
  warn?: RuleKnob;
  crit?: RuleKnob;
}

/** Code defaults for every rule, without evaluate closures — safe to hand to
 * client components on /alerts/rules. */
export function getRuleCatalog(): RuleCatalogEntry[] {
  return buildRules().map((rule) => ({
    id: rule.id,
    title: rule.title,
    group: RULE_GROUPS[rule.id.split(".")[0] ?? ""] ?? "Other",
    defaultForTicks: rule.meta?.defaultForTicks ?? rule.forTicks,
    defaultEnvs: rule.meta?.defaultEnvs ?? ["prod", "staging", "dev"],
    warn: rule.meta?.warn,
    crit: rule.meta?.crit,
  }));
}
