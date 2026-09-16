import { queryLastWriteByTag } from "@repo/metrics";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listNodes } from "@repo/supabase/queries/obs-nodes";
import { listIngestNodes } from "@repo/supabase/queries/ingest-nodes";

// Fleet overview for the /ingest and /obs dashboards: every REGISTERED node
// (the registry is the source of truth, not Influx) with a live /health probe
// and its last metric write. Same health URLs the alert engine probes —
// OBS nodes expose /health on api_url, ingest boxes on :8090 over the tailnet.

/** Shorter than the engine's 10s: a page render blocks on the slowest probe. */
const FLEET_PROBE_TIMEOUT_MS = 4_000;

export interface FleetNode {
  id: string;
  name: string;
  /** Reachable address — tailnet IP for ingest, api host for OBS. Far more
   *  useful in the UI than the registry UUID. */
  address: string | null;
  /** Registry status (linked / pending / …). */
  status: string;
  maintenance: boolean;
  createdAt: string;
  /** "unknown" = no health URL to probe (e.g. still pending). */
  health: "healthy" | "unreachable" | "unknown";
  healthDetail: string | null;
  healthLatencyMs: number | null;
  lastMetricAt: string | null;
}

interface RegistryRow {
  id: string;
  name: string;
  status: string;
  maintenance: boolean;
  created_at: string;
  address: string | null;
  healthUrl: string | null;
}

async function loadRegistryRows(kind: "ingest" | "obs"): Promise<RegistryRow[]> {
  if (kind === "obs") {
    const { data, error } = await listNodes(supabaseAdmin);
    if (error || !data) throw new Error(`Couldn't load obs_nodes: ${error}`);
    return data.map((n) => ({
      id: n.id,
      name: n.name,
      status: n.status,
      maintenance: n.maintenance,
      created_at: n.created_at,
      address: n.api_url ? n.api_url.replace(/^https?:\/\//, "").replace(/\/$/, "") : null,
      healthUrl: n.api_url ? `${n.api_url.replace(/\/$/, "")}/health` : null,
    }));
  }
  const { data, error } = await listIngestNodes(supabaseAdmin);
  if (error || !data) throw new Error(`Couldn't load ingest_nodes: ${error}`);
  return data.map((n) => ({
    id: n.id,
    name: n.name,
    status: n.status,
    maintenance: n.maintenance,
    created_at: n.created_at,
    address: n.tailscale_ip ?? null,
    healthUrl: n.tailscale_ip ? `http://${n.tailscale_ip}:8090/health` : null,
  }));
}

async function probeHealth(url: string): Promise<{ ok: boolean; detail: string; latencyMs: number }> {
  const started = performance.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(FLEET_PROBE_TIMEOUT_MS),
      cache: "no-store",
    });
    return { ok: res.ok, detail: `HTTP ${res.status}`, latencyMs: performance.now() - started };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, detail: message, latencyMs: performance.now() - started };
  }
}

export async function getFleet(kind: "ingest" | "obs"): Promise<FleetNode[]> {
  const rows = await loadRegistryRows(kind);
  if (rows.length === 0) return [];

  // Last metric write per node — tolerated to fail (Influx down ≠ no fleet).
  let lastSeenByNode = new Map<string, string>();
  try {
    const measurement = kind === "obs" ? "obs_node" : "host_system";
    const lastWrites = await queryLastWriteByTag(measurement, "node_id", "24h");
    lastSeenByNode = new Map(lastWrites.map((w) => [w.tagValue, w.lastSeen]));
  } catch {
    // charts on the same page will surface an Influx outage
  }

  return Promise.all(
    rows.map(async (row): Promise<FleetNode> => {
      const probe = row.healthUrl ? await probeHealth(row.healthUrl) : null;
      return {
        id: row.id,
        name: row.name,
        address: row.address,
        status: row.status,
        maintenance: row.maintenance,
        createdAt: row.created_at,
        health: probe === null ? "unknown" : probe.ok ? "healthy" : "unreachable",
        healthDetail: probe?.detail ?? null,
        healthLatencyMs: probe === null ? null : Math.round(probe.latencyMs),
        lastMetricAt: lastSeenByNode.get(row.id) ?? null,
      };
    }),
  );
}
