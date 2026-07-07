import {
  queryHostCpu,
  queryHostMemUsed,
  queryHostRxBandwidth,
  queryHostTxBandwidth,
  queryActiveIngestSignals,
} from "@repo/metrics";
import { NextResponse } from "next/server";
import { getRegisteredNodeIds, filterToRegistered, labelNodes } from "@/lib/registry-nodes";
import { getFleet } from "@/lib/node-fleet";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fluxRange = searchParams.get("range") ?? "24h";
  const window = searchParams.get("window") ?? "1h";

  try {
    // Each source is independently fail-soft: one slow/broken query (e.g. the
    // active-signals pivot) must degrade only its own panel, never blank the
    // whole page.
    const [hostCpu, hostMem, hostRx, hostTx, activeSignals, registeredIds, fleet] = await Promise.all([
      queryHostCpu(fluxRange, window).catch(() => []),
      queryHostMemUsed(fluxRange, window).catch(() => []),
      queryHostRxBandwidth(fluxRange, window).catch(() => []),
      queryHostTxBandwidth(fluxRange, window).catch(() => []),
      queryActiveIngestSignals().catch(() => []),
      getRegisteredNodeIds("ingest_nodes").catch(() => null),
      getFleet("ingest").catch(() => []),
    ]);

    const nodeNames = new Map(fleet.map((n) => [n.id, n.name]));
    return NextResponse.json({
      hostCpu: labelNodes(filterToRegistered(hostCpu, registeredIds, (p) => p.nodeId), nodeNames),
      hostMem: labelNodes(filterToRegistered(hostMem, registeredIds, (p) => p.nodeId), nodeNames),
      hostRx: labelNodes(filterToRegistered(hostRx, registeredIds, (p) => p.nodeId), nodeNames),
      hostTx: labelNodes(filterToRegistered(hostTx, registeredIds, (p) => p.nodeId), nodeNames),
      activeSignals,
      fleet,
    });
  } catch (err) {
    console.error("[ingest metrics]", err);
    return NextResponse.json({ hostCpu: [], hostMem: [], hostRx: [], hostTx: [], activeSignals: [] });
  }
}
