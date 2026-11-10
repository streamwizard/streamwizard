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
  queryHostSnapshot,
  queryActiveIngestSignals,
} from "@repo/metrics";
import { Cpu, Network } from "lucide-react";
import type { NodeMetricPoint } from "@/components/shared/charts/node-metric-chart";
import { NodeMetricChart } from "@/components/shared/charts/node-metric-chart";
import { IngestFleetOverview, type IngestNodeFacts } from "@/components/ingest/ingest-node-table";
import { CollapsibleCharts } from "@/components/shared/charts/collapsible-charts";
import { SectionHeading } from "@/components/shared/page/section-heading";
import { ChartGrid } from "@/components/shared/stat-grid";
import { getRegisteredNodeIds, filterToRegistered, labelNodes } from "@/lib/nodes/registry-nodes";
import { getFleet, type FleetNode } from "@/lib/nodes/node-fleet";
import { mergeIngestNodes } from "@/lib/nodes/ingest-nodes";
import { listIngestNodesAction } from "@/actions/nodes/ingest";

const API_PATH = "/api/metrics/ingest";

export async function IngestFleetTab() {
  let fleet: FleetNode[] = [];
  try {
    fleet = await getFleet("ingest");
  } catch {
    // registry unreachable: the list renders its empty state
  }
  // Fail-soft per source so one broken query can't blank every panel.
  const [cpu, mem, rx, tx, disk, steal, load, tsRx, tsTx, hostSnapshot, activeSignals, registeredIds, registry] = await Promise.all([
    queryHostCpu("24h", "1h").catch(() => []),
    queryHostMemUsed("24h", "1h").catch(() => []),
    queryHostRxBandwidth("24h", "1h").catch(() => []),
    queryHostTxBandwidth("24h", "1h").catch(() => []),
    queryHostDiskUsed("24h", "1h").catch(() => []),
    queryHostCpuSteal("24h", "1h").catch(() => []),
    queryHostLoadAvg("24h", "1h").catch(() => []),
    queryHostTailscaleRx("24h", "1h").catch(() => []),
    queryHostTailscaleTx("24h", "1h").catch(() => []),
    queryHostSnapshot().catch(() => []),
    queryActiveIngestSignals().catch(() => []),
    getRegisteredNodeIds("ingest_nodes").catch(() => null),
    listIngestNodesAction()
      .then((res) => res.data ?? [])
      .catch(() => []),
  ]);

  // Influx keeps points from deleted nodes until they age out of the range;
  // show only nodes that still exist in the registry, labeled by name.
  const nodeNames = new Map(fleet.map((n) => [n.id, n.name]));
  const show = (points: NodeMetricPoint[]) => labelNodes(filterToRegistered(points, registeredIds, (p) => p.nodeId), nodeNames);
  const hostCpu = show(cpu);
  const hostMem = show(mem);
  const hostRx = show(rx);
  const hostTx = show(tx);
  const hostDisk = show(disk);
  const hostSteal = show(steal);
  const hostLoad = show(load);
  const hostTsRx = show(tsRx);
  const hostTsTx = show(tsTx);

  // Only the registry columns the list shows cross to the browser.
  const facts: IngestNodeFacts[] = registry.map((n) => ({
    id: n.id,
    name: n.name,
    status: n.status,
    maintenance: n.maintenance,
    tailscale_ip: n.tailscale_ip,
    public_hostname: n.public_hostname,
    public_ip: n.public_ip,
  }));

  return (
    <>
      <IngestFleetOverview
        // Registry + health + latest resource snapshot, one row per node.
        initial={{ ingestNodes: mergeIngestNodes(fleet, hostSnapshot), activeSignals }}
        initialReporting={new Set(hostCpu.map((p) => p.nodeId)).size}
        initialRegistered={registeredIds?.size ?? null}
        facts={facts}
      />

      <CollapsibleCharts>
        <section className="space-y-3">
          <SectionHeading icon={Cpu}>Host resources</SectionHeading>
          <ChartGrid>
            <NodeMetricChart title="CPU %" initialData={hostCpu} apiPath={API_PATH} dataKey="hostCpu" format="percent" />
            <NodeMetricChart title="CPU steal %" initialData={hostSteal} apiPath={API_PATH} dataKey="hostSteal" format="percent" />
            <NodeMetricChart title="RAM used (MB)" initialData={hostMem} apiPath={API_PATH} dataKey="hostMem" />
            <NodeMetricChart title="Disk used %" initialData={hostDisk} apiPath={API_PATH} dataKey="hostDisk" format="percent" />
            <NodeMetricChart title="Load avg (1m)" initialData={hostLoad} apiPath={API_PATH} dataKey="hostLoad" />
          </ChartGrid>
        </section>

        <section className="space-y-3">
          <SectionHeading icon={Network}>Bandwidth</SectionHeading>
          <ChartGrid>
            <NodeMetricChart title="Incoming" initialData={hostRx} apiPath={API_PATH} dataKey="hostRx" format="bytesPerSec" />
            <NodeMetricChart title="Outgoing" initialData={hostTx} apiPath={API_PATH} dataKey="hostTx" format="bytesPerSec" />
            <NodeMetricChart title="Tailscale in" initialData={hostTsRx} apiPath={API_PATH} dataKey="hostTsRx" format="bytesPerSec" />
            <NodeMetricChart title="Tailscale out" initialData={hostTsTx} apiPath={API_PATH} dataKey="hostTsTx" format="bytesPerSec" />
          </ChartGrid>
        </section>
      </CollapsibleCharts>
    </>
  );
}
