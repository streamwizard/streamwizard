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
import type { NodeMetricPoint } from "@/components/charts/node-metric-chart";
import { NodeMetricChart } from "@/components/charts/node-metric-chart";
import { IngestFleetOverview, type IngestNodeFacts } from "@/components/charts/ingest-node-table";
import { IngestLivePanel } from "@/components/charts/ingest-live-panel";
import { CollapsibleCharts } from "@/components/admin/collapsible-charts";
import { IngestNodesSection } from "@/components/admin/ingest-nodes-section";
import { PageTabs } from "@/components/page-tabs";
import { IngestLiveProvider } from "@/lib/ingest-live-context";
import { PageHeader } from "@/components/widgets/page-header";
import { SectionHeading } from "@/components/widgets/section-heading";
import { LiveIndicator } from "@/components/widgets/live-indicator";
import { ChartGrid } from "@/components/widgets/stat-grid";
import { getRegisteredNodeIds, filterToRegistered, labelNodes } from "@/lib/registry-nodes";
import { getFleet, type FleetNode } from "@/lib/node-fleet";
import { mergeIngestNodes } from "@/lib/ingest-nodes";
import { listIngestNodesAction } from "@/actions/ingest-nodes";

export const dynamic = "force-dynamic";

const API_PATH = "/api/metrics/ingest";

const DESCRIPTIONS = {
  fleet: "Health and load of the boxes that take in SRT and SRTLA.",
  live: "Streams and bandwidth as the monitor socket reports them.",
  manage: "Register, edit and delete ingest boxes.",
} as const;

export default async function IngestDashboard({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  const view = tab === "live" || tab === "manage" ? tab : "fleet";

  return (
    <div className="space-y-6">
      <PageHeader title="Ingest servers" description={DESCRIPTIONS[view]}>
        {/* Fleet follows the header's refresh. Live has its own socket status; Manage is read once. */}
        {view === "fleet" && <LiveIndicator />}
      </PageHeader>
      <PageTabs
        label="Ingest servers sections"
        tabs={[
          { href: "/ingest", label: "Fleet", active: view === "fleet" },
          { href: "/ingest?tab=live", label: "Live", active: view === "live" },
          { href: "/ingest?tab=manage", label: "Manage", active: view === "manage" },
        ]}
      />
      {view === "manage" ? (
        <ManageTab />
      ) : (
        // One shared monitor WebSocket for every live consumer below: the
        // Live tab, and the Fleet list's network column.
        <IngestLiveProvider
          wsUrl={process.env.NEXT_PUBLIC_WS_SERVER_URL ?? null}
          monitorSecret={process.env.NEXT_PUBLIC_MONITOR_SECRET ?? null}
        >
          {view === "live" ? <LiveTab /> : <FleetTab />}
        </IngestLiveProvider>
      )}
    </div>
  );
}

async function ManageTab() {
  const { data: managedNodes, error: manageError } = await listIngestNodesAction();
  return <IngestNodesSection initialNodes={managedNodes ?? []} error={manageError} />;
}

async function LiveTab() {
  // The socket carries node ids; the registry turns them into names.
  const [activeSignals, registry] = await Promise.all([
    queryActiveIngestSignals().catch(() => []),
    listIngestNodesAction()
      .then((res) => res.data ?? [])
      .catch(() => []),
  ]);
  const nodeNames = Object.fromEntries(registry.map((n) => [n.id, n.name]));

  return <IngestLivePanel initialSignals={activeSignals} nodeNames={nodeNames} />;
}

async function FleetTab() {
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
