import {
  queryHostCpu,
  queryHostMemUsed,
  queryHostRxBandwidth,
  queryHostTxBandwidth,
  queryHostDiskUsed,
  queryHostCpuSteal,
  queryHostLoadAvg,
  queryHostTailscaleRx,
  queryHostTailscaleTx,
  queryActiveIngestSignals,
} from "@repo/metrics";
import type { ActiveIngestSignal } from "@repo/metrics";
import type { NodeMetricPoint } from "@/components/charts/node-metric-chart";
import { NodeMetricChart } from "@/components/charts/node-metric-chart";
import { ActiveSignalsTable } from "@/components/charts/active-signals-table";
import { NodeFleetTable } from "@/components/charts/node-fleet-table";
import { StatCard } from "@/components/widgets/stat-card";
import { getRegisteredNodeIds, filterToRegistered, labelNodes } from "@/lib/registry-nodes";
import { getFleet, type FleetNode } from "@/lib/node-fleet";

export const dynamic = "force-dynamic";

export default async function IngestDashboard() {
  let hostCpu: NodeMetricPoint[] = [];
  let hostMem: NodeMetricPoint[] = [];
  let hostRx: NodeMetricPoint[] = [];
  let hostTx: NodeMetricPoint[] = [];
  let hostDisk: NodeMetricPoint[] = [];
  let hostSteal: NodeMetricPoint[] = [];
  let hostLoad: NodeMetricPoint[] = [];
  let hostTsRx: NodeMetricPoint[] = [];
  let hostTsTx: NodeMetricPoint[] = [];
  let activeSignals: ActiveIngestSignal[] = [];

  let registeredIds: Set<string> | null = null;
  let fleet: FleetNode[] = [];
  try {
    fleet = await getFleet("ingest");
  } catch {
    // registry unreachable — table renders its empty state
  }
  // Fail-soft per source so one broken query can't blank every panel.
  [hostCpu, hostMem, hostRx, hostTx, hostDisk, hostSteal, hostLoad, hostTsRx, hostTsTx, activeSignals, registeredIds] =
    await Promise.all([
      queryHostCpu("24h", "1h").catch(() => []),
      queryHostMemUsed("24h", "1h").catch(() => []),
      queryHostRxBandwidth("24h", "1h").catch(() => []),
      queryHostTxBandwidth("24h", "1h").catch(() => []),
      queryHostDiskUsed("24h", "1h").catch(() => []),
      queryHostCpuSteal("24h", "1h").catch(() => []),
      queryHostLoadAvg("24h", "1h").catch(() => []),
      queryHostTailscaleRx("24h", "1h").catch(() => []),
      queryHostTailscaleTx("24h", "1h").catch(() => []),
      queryActiveIngestSignals().catch(() => []),
      getRegisteredNodeIds("ingest_nodes").catch(() => null),
    ]);

  // Influx keeps points from deleted nodes until they age out of the range;
  // show only nodes that still exist in the registry, labeled by name.
  const nodeNames = new Map(fleet.map((n) => [n.id, n.name]));
  const show = (points: NodeMetricPoint[]) =>
    labelNodes(filterToRegistered(points, registeredIds, (p) => p.nodeId), nodeNames);
  hostCpu = show(hostCpu);
  hostMem = show(hostMem);
  hostRx = show(hostRx);
  hostTx = show(hostTx);
  hostDisk = show(hostDisk);
  hostSteal = show(hostSteal);
  hostLoad = show(hostLoad);
  hostTsRx = show(hostTsRx);
  hostTsTx = show(hostTsTx);

  const nodeCount = new Set(hostCpu.map((p) => p.nodeId)).size;
  const userCount = new Set(activeSignals.map((s) => s.userId)).size;
  const totalKbps = activeSignals.reduce((acc, s) => acc + s.kbps, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Ingest Servers</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Last 24 hours · refreshes every 30s</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Fleet</h2>
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            title="Ingest Nodes"
            value={registeredIds === null ? nodeCount : `${nodeCount} / ${registeredIds.size}`}
            description={registeredIds === null ? "Reporting host metrics" : "Reporting / registered"}
          />
          <StatCard title="Active Signals" value={activeSignals.length} description="Incoming streams right now" />
          <StatCard title="Streaming Users" value={userCount} description="Distinct users currently live" />
          <StatCard title="Total Incoming" value={`${totalKbps.toFixed(0)} kbps`} description="Sum across active signals" />
        </div>
        <NodeFleetTable initialData={fleet} apiPath="/api/metrics/ingest" title="Registered Nodes" />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Host Resources</h2>
        <div className="grid grid-cols-2 gap-4">
          <NodeMetricChart title="CPU %" initialData={hostCpu} apiPath="/api/metrics/ingest" dataKey="hostCpu" format="percent" />
          <NodeMetricChart title="CPU Steal %" initialData={hostSteal} apiPath="/api/metrics/ingest" dataKey="hostSteal" format="percent" />
          <NodeMetricChart title="RAM Used (MB)" initialData={hostMem} apiPath="/api/metrics/ingest" dataKey="hostMem" />
          <NodeMetricChart title="Disk Used %" initialData={hostDisk} apiPath="/api/metrics/ingest" dataKey="hostDisk" format="percent" />
          <NodeMetricChart title="Load Avg (1m)" initialData={hostLoad} apiPath="/api/metrics/ingest" dataKey="hostLoad" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Bandwidth</h2>
        <div className="grid grid-cols-2 gap-4">
          <NodeMetricChart title="Incoming" initialData={hostRx} apiPath="/api/metrics/ingest" dataKey="hostRx" format="bytesPerSec" />
          <NodeMetricChart title="Outgoing" initialData={hostTx} apiPath="/api/metrics/ingest" dataKey="hostTx" format="bytesPerSec" />
          <NodeMetricChart title="Tailscale In" initialData={hostTsRx} apiPath="/api/metrics/ingest" dataKey="hostTsRx" format="bytesPerSec" />
          <NodeMetricChart title="Tailscale Out" initialData={hostTsTx} apiPath="/api/metrics/ingest" dataKey="hostTsTx" format="bytesPerSec" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Signals by User</h2>
        <ActiveSignalsTable initialData={activeSignals} />
      </section>
    </div>
  );
}
