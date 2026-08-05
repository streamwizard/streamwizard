import {
  queryObsInstanceCpu,
  queryObsInstanceRam,
  queryObsInstanceVram,
  queryObsInstanceRx,
  queryObsInstanceTx,
} from "@repo/metrics";
import type { ObsInstanceMetricPoint } from "@repo/metrics";
import { NextResponse } from "next/server";
import { settled } from "@/lib/settled";

export const dynamic = "force-dynamic";

// The charts consume { time, nodeId, value } — for a single-instance page the
// series key is cosmetic, so points are relabeled to one stable key.
function toNodePoints(points: ObsInstanceMetricPoint[], label: string) {
  return points.map((p) => ({ time: p.time, nodeId: label, value: p.value }));
}

export async function GET(request: Request, { params }: { params: Promise<{ instanceId: string }> }) {
  const { instanceId } = await params;
  const { searchParams } = new URL(request.url);
  const fluxRange = searchParams.get("range") ?? "24h";
  const window = searchParams.get("window") ?? "1h";

  const [cpuRes, ramRes, vramRes, rxRes, txRes] = await Promise.allSettled([
    queryObsInstanceCpu(instanceId, fluxRange, window),
    queryObsInstanceRam(instanceId, fluxRange, window),
    queryObsInstanceVram(instanceId, fluxRange, window),
    queryObsInstanceRx(instanceId, fluxRange, window),
    queryObsInstanceTx(instanceId, fluxRange, window),
  ]);

  const label = "instance";
  return NextResponse.json({
    instanceCpu: toNodePoints(settled(cpuRes, [], "obs instance cpu"), label),
    instanceRam: toNodePoints(settled(ramRes, [], "obs instance ram"), label),
    instanceVram: toNodePoints(settled(vramRes, [], "obs instance vram"), label),
    instanceRx: toNodePoints(settled(rxRes, [], "obs instance rx"), label),
    instanceTx: toNodePoints(settled(txRes, [], "obs instance tx"), label),
  });
}
