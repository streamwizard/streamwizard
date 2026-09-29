import {
  agentEnabledFromConfig,
  createProxmoxClient,
  parseAgentFsInfo,
  parseAgentInterfaces,
  parseLxcInterfaces,
  parsePveHosts,
  pveAuthorization,
  pveNodeName,
  type AgentState,
  type ProxmoxClient,
} from "@repo/proxmox";
import { env } from "@/lib/env";

/**
 * What Influx can't tell about a guest, read from the PVE API when a page
 * renders: its IPs, whether the guest agent answers, and (from the agent) its
 * disk use. Every call is short and cached briefly, and a failure only means
 * "—" in those columns; the rest of /vms comes from Influx and never waits on
 * this.
 */

export interface GuestNet {
  /** Sorted IPv4s; empty when unknown. */
  ips: string[];
  /** ok, off (no agent configured) or error (configured but not answering). */
  agent: AgentState;
  disk: { usedBytes: number; totalBytes: number } | null;
}

export interface GuestRef {
  /** PVE node name; equals the PVE_HOSTS name. */
  host: string;
  vmid: number;
  type: "qemu" | "lxc";
  running: boolean;
}

const CALL_TIMEOUT_MS = 2_500;
const CACHE_TTL_MS = 30_000;
/** Parallel PVE calls at most; a host has a few dozen guests at most. */
const CONCURRENCY = 8;

const NO_DATA: GuestNet = { ips: [], agent: "off", disk: null };

interface HostClient {
  node: string;
  client: ProxmoxClient;
}

let clients: Map<string, HostClient> | null = null;

/** Clients keyed by node name, built once. Empty when PVE_HOSTS is unset or
 * malformed (the error never echoes the value: it holds token secrets). */
function hostClients(): Map<string, HostClient> {
  if (clients) return clients;
  clients = new Map();
  try {
    for (const host of parsePveHosts(env.PVE_HOSTS)) {
      const node = pveNodeName(host);
      clients.set(node, {
        node,
        client: createProxmoxClient({
          baseUrl: host.url,
          authorization: pveAuthorization(host.tokenId, host.tokenSecret),
          label: host.name,
          timeoutMs: CALL_TIMEOUT_MS,
        }),
      });
    }
  } catch (error) {
    console.error("[pve]", (error as Error).message);
  }
  return clients;
}

export const pveConfigured = () => hostClients().size > 0;

const cache = new Map<string, { at: number; value: Promise<GuestNet> }>();

async function readGuest(ref: GuestRef): Promise<GuestNet> {
  const host = hostClients().get(ref.host);
  if (!host || !ref.running) return NO_DATA;
  const base = `/nodes/${encodeURIComponent(host.node)}/${ref.type}/${ref.vmid}`;

  if (ref.type === "lxc") {
    try {
      return { ips: parseLxcInterfaces(await host.client.get(`${base}/interfaces`)), agent: "off", disk: null };
    } catch {
      return NO_DATA;
    }
  }

  let enabled: boolean;
  try {
    enabled = agentEnabledFromConfig(await host.client.get(`${base}/config`));
  } catch {
    return NO_DATA;
  }
  if (!enabled) return NO_DATA;

  const [net, fs] = await Promise.allSettled([
    host.client.get(`${base}/agent/network-get-interfaces`),
    host.client.get(`${base}/agent/get-fsinfo`),
  ]);
  if (net.status === "rejected") return { ips: [], agent: "error", disk: null };
  return {
    ips: parseAgentInterfaces(net.value),
    agent: "ok",
    disk: fs.status === "fulfilled" ? parseAgentFsInfo(fs.value) : null,
  };
}

function cachedGuest(ref: GuestRef): Promise<GuestNet> {
  const key = `${ref.host}:${ref.vmid}:${ref.running ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const value = readGuest(ref).catch(() => NO_DATA);
  cache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * IPs, agent state and disk use for many guests, keyed "<host>:<vmid>".
 * Never rejects. Pages hand the promise to the client table, which streams
 * the columns in under Suspense.
 */
export async function getGuestNet(refs: GuestRef[]): Promise<Record<string, GuestNet>> {
  if (!pveConfigured()) return {};
  const out: Record<string, GuestNet> = {};
  let next = 0;
  async function worker() {
    while (next < refs.length) {
      const ref = refs[next++]!;
      out[`${ref.host}:${ref.vmid}`] = await cachedGuest(ref);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, refs.length) }, worker));
  return out;
}
