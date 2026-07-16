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
import { getFleet, type FleetNode } from "@/lib/node-fleet";
import { settled } from "@/lib/settled";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fluxRange = searchParams.get("range") ?? "24h";
  const window = searchParams.get("window") ?? "1h";

  const [
    cpuRes,
    ramRes,
    gpuRes,
    vramRes,
    instanceCountRes,
    rxRes,
    txRes,
    snapshotRes,
    instanceSnapshotRes,
    registeredIdsRes,
    fleetRes,
  ] = await Promise.allSettled([
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
    getFleet("obs"),
  ]);

  // null (not []) keeps filterToRegistered permissive when the registry is down.
  const registeredIds = settled(registeredIdsRes, null, "obs registered ids");
  const fleet = settled(fleetRes, [] as FleetNode[], "obs fleet");
  const nodeNames = new Map(fleet.map((n) => [n.id, n.name]));

  return NextResponse.json({
    nodeCpu: labelNodes(filterToRegistered(settled(cpuRes, [], "obs node cpu"), registeredIds, (p) => p.nodeId), nodeNames),
    nodeRam: labelNodes(filterToRegistered(settled(ramRes, [], "obs node ram"), registeredIds, (p) => p.nodeId), nodeNames),
    nodeGpu: labelNodes(filterToRegistered(settled(gpuRes, [], "obs node gpu"), registeredIds, (p) => p.nodeId), nodeNames),
    nodeVram: labelNodes(filterToRegistered(settled(vramRes, [], "obs node vram"), registeredIds, (p) => p.nodeId), nodeNames),
    nodeInstanceCount: labelNodes(
      filterToRegistered(settled(instanceCountRes, [], "obs node instance count"), registeredIds, (p) => p.nodeId),
      nodeNames,
    ),
    nodeRx: labelNodes(filterToRegistered(settled(rxRes, [], "obs node rx"), registeredIds, (p) => p.nodeId), nodeNames),
    nodeTx: labelNodes(filterToRegistered(settled(txRes, [], "obs node tx"), registeredIds, (p) => p.nodeId), nodeNames),
    nodeSnapshot: labelNodes(
      filterToRegistered(settled(snapshotRes, [], "obs node snapshot"), registeredIds, (n) => n.nodeId),
      nodeNames,
    ),
    instanceSnapshot: labelNodes(
      filterToRegistered(settled(instanceSnapshotRes, [], "obs instance snapshot"), registeredIds, (i) => i.nodeId),
      nodeNames,
    ),
    fleet,
  });
}
