import type { IngestNodeBandwidthPayload } from "@repo/types";
import type { IngestNodeLive } from "./monitor/types";

// Latest bandwidth reading per ingest node, fed by `node_metrics` bot
// messages (one per node every ~10s). Keyed by the node's self-reported
// node_id; entries age out after STALE_MS so a dead node drops from the
// snapshot instead of freezing at its last reading forever.

// ~3 missed 10s sampler ticks — long enough to ride out a reconnect,
// short enough that a dead node disappears promptly.
const STALE_MS = 30_000;

const nodes = new Map<string, { entry: IngestNodeLive; receivedAt: number }>();

export function updateNodeBandwidth(payload: IngestNodeBandwidthPayload): void {
  // Clamp rather than reject: a counter-reset on the node can yield a
  // negative delta for one tick, which shouldn't poison the fleet total.
  const clamp = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  nodes.set(payload.node_id, {
    entry: {
      nodeId: payload.node_id,
      ts: payload.ts,
      rxBps: clamp(payload.rx_bytes_per_sec),
      txBps: clamp(payload.tx_bytes_per_sec),
      tsRxBps: clamp(payload.tailscale_rx_bytes_per_sec),
      tsTxBps: clamp(payload.tailscale_tx_bytes_per_sec),
    },
    receivedAt: Date.now(),
  });
}

export function getLiveIngestNodes(): {
  nodes: IngestNodeLive[];
  fleet: { rxBps: number; txBps: number; nodeCount: number };
} {
  const now = Date.now();
  const live: IngestNodeLive[] = [];
  let rxBps = 0;
  let txBps = 0;

  for (const [nodeId, { entry, receivedAt }] of nodes) {
    if (now - receivedAt > STALE_MS) {
      nodes.delete(nodeId);
      continue;
    }
    live.push(entry);
    rxBps += entry.rxBps;
    txBps += entry.txBps;
  }

  return { nodes: live, fleet: { rxBps, txBps, nodeCount: live.length } };
}
