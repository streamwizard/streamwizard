import {
  queryObsNodeCpu,
  queryObsNodeRam,
  queryObsNodeGpuUtil,
  queryObsNodeVram,
  queryObsNodeInstanceCount,
  queryObsNodeBandwidth,
  queryObsNodeSnapshot,
  queryObsInstanceSnapshot,
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
    const [
      nodeCpu,
      nodeRam,
      nodeGpu,
      nodeVram,
      nodeInstanceCount,
      nodeRx,
      nodeTx,
      nodeSnapshot,
      instanceSnapshot,
      registeredIds,
      fleet,
    ] = await Promise.all([
      queryObsNodeCpu(fluxRange, window),
      queryObsNodeRam(fluxRange, window),
      queryObsNodeGpuUtil(fluxRange, window),
      queryObsNodeVram(fluxRange, window),
      queryObsNodeInstanceCount(fluxRange, window),
      queryObsNodeBandwidth("rx", fluxRange, window),
      queryObsNodeBandwidth("tx", fluxRange, window),
      queryObsNodeSnapshot(),
      queryObsInstanceSnapshot(),
      getRegisteredNodeIds("obs_nodes"),
      getFleet("obs").catch(() => []),
    ]);

    const nodeNames = new Map(fleet.map((n) => [n.id, n.name]));
    return NextResponse.json({
      nodeCpu: labelNodes(filterToRegistered(nodeCpu, registeredIds, (p) => p.nodeId), nodeNames),
      nodeRam: labelNodes(filterToRegistered(nodeRam, registeredIds, (p) => p.nodeId), nodeNames),
      nodeGpu: labelNodes(filterToRegistered(nodeGpu, registeredIds, (p) => p.nodeId), nodeNames),
      nodeVram: labelNodes(filterToRegistered(nodeVram, registeredIds, (p) => p.nodeId), nodeNames),
      nodeInstanceCount: labelNodes(filterToRegistered(nodeInstanceCount, registeredIds, (p) => p.nodeId), nodeNames),
      nodeRx: labelNodes(filterToRegistered(nodeRx, registeredIds, (p) => p.nodeId), nodeNames),
      nodeTx: labelNodes(filterToRegistered(nodeTx, registeredIds, (p) => p.nodeId), nodeNames),
      nodeSnapshot: labelNodes(filterToRegistered(nodeSnapshot, registeredIds, (n) => n.nodeId), nodeNames),
      instanceSnapshot: labelNodes(filterToRegistered(instanceSnapshot, registeredIds, (i) => i.nodeId), nodeNames),
      fleet,
    });
  } catch (err) {
    console.error("[obs metrics]", err);
    return NextResponse.json({
      nodeCpu: [],
      nodeRam: [],
      nodeGpu: [],
      nodeVram: [],
      nodeInstanceCount: [],
      nodeRx: [],
      nodeTx: [],
      nodeSnapshot: [],
      instanceSnapshot: [],
    });
  }
}
