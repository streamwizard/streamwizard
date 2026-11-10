import { queryObsOutputWindowStats, type ObsOutputWindowStats } from "@repo/metrics";
import type { AlertRule, Breach, EnvContext, RuleOverrides, Severity } from "../types";
import { customRule, perTick } from "./builders";
import {
  STREAM_CONGESTION_CRIT_PCT,
  STREAM_CONGESTION_WARN_PCT,
  STREAM_DROPPED_CRIT_PCT,
  STREAM_DROPPED_WARN_PCT,
  STREAM_LOOKBACK_MIN,
  STREAM_MIN_FRAMES,
  STREAM_RECONNECT_LOOP_COUNT,
  STREAM_RECONNECT_LOOP_WINDOW_MIN,
} from "./thresholds";

// Stream output health per OBS instance (stream.*), read from the obs_output
// stats obs-instance-manager writes every 10s while OBS runs.
//
// An entity is "<user_id>:<instance_id>": the streamer comes first so alerts
// can later be routed per streamer, the way app.* rules key on "<env>:<app>".

const recent = perTick(() => queryObsOutputWindowStats(`${STREAM_LOOKBACK_MIN}m`));
const reconnectWindow = perTick(() => queryObsOutputWindowStats(`${STREAM_RECONNECT_LOOP_WINDOW_MIN}m`));

export const streamEntityId = (s: Pick<ObsOutputWindowStats, "userId" | "instanceId">) => `${s.userId}:${s.instanceId}`;

/** Streamer display names by user id; falls back to the id when the lookup fails. */
async function streamerNames(ctx: EnvContext, userIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (userIds.length === 0) return names;
  try {
    const { data } = await ctx.supabase.from("users").select("id, name").in("id", userIds);
    for (const u of data ?? []) if (u.name) names.set(u.id, u.name);
  } catch {
    // A name is a nicety: the alert still fires with the id.
  }
  return names;
}

interface Candidate {
  stats: ObsOutputWindowStats;
  severity: Severity;
  value: number;
}

/** Turns candidates into breaches with the streamer's name in the message. */
async function toBreaches(
  ctx: EnvContext,
  candidates: Candidate[],
  describe: (c: Candidate) => string,
): Promise<Breach[]> {
  const names = await streamerNames(ctx, [...new Set(candidates.map((c) => c.stats.userId))]);
  return candidates.map((c) => ({
    entityId: streamEntityId(c.stats),
    severity: c.severity,
    value: c.value,
    message: `Stream by ${names.get(c.stats.userId) ?? c.stats.userId} (instance ${c.stats.instanceId}) ${describe(c)}`,
  }));
}

function severityAbove(value: number, t: { warn: number; crit: number }): Severity | null {
  if (value > t.crit) return "crit";
  if (value > t.warn) return "warn";
  return null;
}

export function streamQualityRules(overrides: RuleOverrides): AlertRule[] {
  return [
    customRule(
      {
        id: "stream.dropped_frames",
        title: "Stream dropping frames",
        forTicks: 2,
        envs: ["prod", "staging"],
        warn: { default: STREAM_DROPPED_WARN_PCT, unit: "%", direction: "above" },
        crit: { default: STREAM_DROPPED_CRIT_PCT, unit: "%", direction: "above" },
        async evaluate(ctx, t) {
          const candidates: Candidate[] = [];
          for (const stats of await recent(ctx)) {
            if (stats.totalFrames < STREAM_MIN_FRAMES) continue;
            const value = (stats.droppedFrames / stats.totalFrames) * 100;
            const severity = severityAbove(value, t);
            if (severity) candidates.push({ stats, severity, value });
          }
          return toBreaches(
            ctx,
            candidates,
            (c) =>
              `dropped ${c.value.toFixed(1)}% of frames in the last ${STREAM_LOOKBACK_MIN}m ` +
              `(${c.stats.droppedFrames}/${c.stats.totalFrames}; warn > ${t.warn}%, crit > ${t.crit}%)`,
          );
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "stream.congestion",
        title: "Stream output congested",
        forTicks: 2,
        envs: ["prod", "staging"],
        warn: { default: STREAM_CONGESTION_WARN_PCT, unit: "%", direction: "above" },
        crit: { default: STREAM_CONGESTION_CRIT_PCT, unit: "%", direction: "above" },
        async evaluate(ctx, t) {
          const candidates: Candidate[] = [];
          for (const stats of await recent(ctx)) {
            // Congestion is only written while streaming.
            if (stats.congestion === null) continue;
            const value = stats.congestion * 100;
            const severity = severityAbove(value, t);
            if (severity) candidates.push({ stats, severity, value });
          }
          return toBreaches(
            ctx,
            candidates,
            (c) =>
              `averaged ${c.value.toFixed(0)}% congestion over the last ${STREAM_LOOKBACK_MIN}m ` +
              `(warn > ${t.warn}%, crit > ${t.crit}%)`,
          );
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "stream.reconnect_loop",
        title: "Stream reconnecting repeatedly",
        forTicks: 1,
        envs: ["prod", "staging"],
        crit: {
          default: STREAM_RECONNECT_LOOP_COUNT,
          unit: `reconnects / ${STREAM_RECONNECT_LOOP_WINDOW_MIN}m`,
          direction: "above",
        },
        async evaluate(ctx, t) {
          const candidates: Candidate[] = (await reconnectWindow(ctx))
            .filter((stats) => stats.reconnects >= t.crit)
            .map((stats) => ({ stats, severity: "crit" as const, value: stats.reconnects }));
          return toBreaches(
            ctx,
            candidates,
            (c) => `reconnected ${c.value}× in the last ${STREAM_RECONNECT_LOOP_WINDOW_MIN}m`,
          );
        },
      },
      overrides,
    ),
  ];
}
