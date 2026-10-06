import type { EventsubConnectionLatest, EventsubShardLatest } from "@repo/metrics";
import type { Breach } from "../types";

/** Alert entity for one shard of one process, e.g. "streamwizard-bot#7". */
export function shardEntity(service: string, shardId: string): string {
  return `${service}#${shardId}`;
}

/**
 * eventsub.disconnected: one breach per shard that has sat in its reconnect
 * loop for longer than critMin. When `collapseAt` or more shards of the same
 * service are down together (a Twitch-wide blip, a network drop on the host)
 * they fold into a single `service#*` breach so staff get one alert, not N.
 *
 * The bot writes one `lost` point per outage, then a `reconnect_attempt`
 * every few seconds until `connected`. An outage is ongoing when the last
 * lost/attempt point is newer than the last connected point; it started at
 * the lost point. One that outlives the window is reported as "over Nh".
 */
export function disconnectedBreaches(
  latest: EventsubConnectionLatest[],
  nowMs: number,
  critMin: number,
  rangeMin: number,
  collapseAt: number,
): Breach[] {
  const byShard = new Map<string, { service: string; shardId: string; points: Partial<Record<string, number>> }>();
  for (const row of latest) {
    const at = new Date(row.time).getTime();
    if (!row.service || Number.isNaN(at)) continue;
    const shardId = row.shardId || "0";
    const key = shardEntity(row.service, shardId);
    const entry = byShard.get(key) ?? { service: row.service, shardId, points: {} };
    entry.points[row.event] = Math.max(entry.points[row.event] ?? 0, at);
    byShard.set(key, entry);
  }

  const down: { service: string; shardId: string; downMs: number; downFor: string }[] = [];
  for (const { service, shardId, points } of byShard.values()) {
    const connected = points.connected ?? 0;
    const lost = points.lost ?? 0;
    const lastDown = Math.max(lost, points.reconnect_attempt ?? 0);
    if (lastDown <= connected) continue;
    const downSince = lost > connected ? lost : nowMs - rangeMin * 60_000;
    const downMs = nowMs - downSince;
    if (downMs < critMin * 60_000) continue;
    const downFor = lost > connected ? `${Math.round(downMs / 60000)}m` : `over ${Math.round(rangeMin / 60)}h`;
    down.push({ service, shardId, downMs, downFor });
  }

  const breaches: Breach[] = [];
  const services = new Set(down.map((d) => d.service));
  for (const service of services) {
    const shards = down.filter((d) => d.service === service);
    if (shards.length >= collapseAt) {
      const longest = shards.reduce((a, b) => (b.downMs > a.downMs ? b : a));
      breaches.push({
        entityId: shardEntity(service, "*"),
        severity: "crit",
        value: shards.length,
        message: `${shards.length} ${service} EventSub shards have been reconnecting to Twitch, the longest for ${longest.downFor}; their events don't arrive until they're back`,
      });
      continue;
    }
    for (const shard of shards) {
      breaches.push({
        entityId: shardEntity(service, shard.shardId),
        severity: "crit",
        value: Math.round(shard.downMs / 1000),
        message: `${service} shard ${shard.shardId} has been reconnecting to Twitch EventSub for ${shard.downFor}; its events don't arrive until it's back`,
      });
    }
  }
  return breaches;
}

/**
 * eventsub.heartbeat_stale: a shard that sent heartbeats in the window but
 * none for staleMin minutes means the process running it is gone (crashed,
 * hung, or not redeployed). Per shard, so one of several processes dying is
 * caught even while the others keep writing.
 */
export function heartbeatStaleBreaches(latest: EventsubShardLatest[], nowMs: number, staleMin: number): Breach[] {
  const breaches: Breach[] = [];
  for (const row of latest) {
    const at = new Date(row.time).getTime();
    if (!row.service || !row.shardId || Number.isNaN(at)) continue;
    const silentMs = nowMs - at;
    if (silentMs < staleMin * 60_000) continue;
    breaches.push({
      entityId: shardEntity(row.service, row.shardId),
      severity: "crit",
      value: Math.round(silentMs / 1000),
      message: `${row.service} shard ${row.shardId} hasn't sent a heartbeat for ${Math.round(silentMs / 60000)}m; the process running it is probably down`,
    });
  }
  return breaches;
}

/**
 * eventsub.shards_degraded: pct% or more of a service's shards report not
 * connected in their latest fresh heartbeat. Stale shards are left to the
 * heartbeat rule. Needs minShards so a lone shard doesn't double up with
 * eventsub.disconnected.
 */
export function shardsDegradedBreaches(
  latest: EventsubShardLatest[],
  nowMs: number,
  pct: number,
  staleMin: number,
  minShards: number,
): Breach[] {
  const byService = new Map<string, { total: number; down: string[] }>();
  for (const row of latest) {
    const at = new Date(row.time).getTime();
    if (!row.service || Number.isNaN(at) || nowMs - at >= staleMin * 60_000) continue;
    const entry = byService.get(row.service) ?? { total: 0, down: [] };
    entry.total++;
    if (!row.connected) entry.down.push(row.shardId);
    byService.set(row.service, entry);
  }

  const breaches: Breach[] = [];
  for (const [service, { total, down }] of byService) {
    if (total < minShards || down.length === 0) continue;
    const downPct = (down.length / total) * 100;
    if (downPct < pct) continue;
    const listed = down.sort((a, b) => Number(a) - Number(b)).slice(0, 10).join(", ");
    breaches.push({
      entityId: service,
      severity: "warn",
      value: downPct,
      message: `${down.length} of ${total} ${service} EventSub shards are down (${downPct.toFixed(0)}%): ${listed}${down.length > 10 ? ", …" : ""}`,
    });
  }
  return breaches;
}
