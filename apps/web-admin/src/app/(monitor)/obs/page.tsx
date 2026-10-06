import {
  queryObsNodeCpu,
  queryObsNodeRam,
  queryObsNodeGpuUtil,
  queryObsNodeEncoderUtil,
  queryObsNodePower,
  queryObsNodeNvencSessions,
  queryObsNodeNvencFps,
  queryObsNodeVram,
  queryObsNodeInstanceCount,
  queryObsNodeBandwidth,
  queryObsNodeSnapshot,
  queryObsInstanceSnapshot,
} from "@repo/metrics";
import { Cpu, MonitorPlay, Network } from "lucide-react";
import type { NodeMetricPoint } from "@/components/charts/node-metric-chart";
import { NodeMetricChart } from "@/components/charts/node-metric-chart";
import { ObsFleetOverview, type ObsNodeFacts } from "@/components/charts/obs-node-table";
import { CollapsibleCharts } from "@/components/admin/collapsible-charts";
import { NodesSection } from "@/components/admin/nodes-section";
import { PageTabs } from "@/components/page-tabs";
import { LiveIndicator } from "@/components/widgets/live-indicator";
import { PageHeader } from "@/components/widgets/page-header";
import { SectionHeading } from "@/components/widgets/section-heading";
import { ChartGrid } from "@/components/widgets/stat-grid";
import { getRegisteredNodeIds, filterToRegistered, labelNodes } from "@/lib/registry-nodes";
import { getFleet, type FleetNode } from "@/lib/node-fleet";
import { settled } from "@/lib/settled";
import { listNodesAction } from "@/actions/nodes";
import { checkNodesHealth } from "@/lib/node-health";

export const dynamic = "force-dynamic";

const API_PATH = "/api/metrics/obs";

export default async function ObsDashboard({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const { tab } = await searchParams;
  const view = tab === "manage" ? "manage" : "fleet";

  return (
    <div className="space-y-6">
      <PageHeader
        title="OBS nodes"
        description={view === "manage" ? "Register, edit and delete the GPU hosts that run Cloud OBS." : "Health and load of the GPU hosts that run Cloud OBS."}
      >
        {/* Everything on Fleet follows the header's refresh; Manage is read once. */}
        {view === "fleet" && <LiveIndicator />}
      </PageHeader>
      <PageTabs
        label="OBS nodes sections"
        tabs={[
          { href: "/obs", label: "Fleet", active: view === "fleet" },
          { href: "/obs?tab=manage", label: "Manage", active: view === "manage" },
        ]}
      />
      {view === "manage" ? <ManageTab /> : <FleetTab />}
    </div>
  );
}

async function ManageTab() {
  // Registry rows plus one /health probe each, both read once with the page.
  const { data: managedNodes, error: manageError } = await listNodesAction();
  const healthByNodeId = managedNodes ? await checkNodesHealth(managedNodes) : {};

  return <NodesSection initialNodes={managedNodes ?? []} error={manageError} healthByNodeId={healthByNodeId} />;
}

async function FleetTab() {
  let fleet: FleetNode[] = [];
  try {
    fleet = await getFleet("obs");
  } catch {
    // registry unreachable: the list falls back to whatever Influx reports
  }

  const [
    cpuRes,
    ramRes,
    gpuRes,
    encoderRes,
    powerRes,
    nvencSessionsRes,
    nvencFpsRes,
    vramRes,
    instanceCountRes,
    rxRes,
    txRes,
    snapshotRes,
    instanceSnapshotRes,
    registeredIdsRes,
    registryRes,
  ] = await Promise.allSettled([
    queryObsNodeCpu("24h", "1h"),
    queryObsNodeRam("24h", "1h"),
    queryObsNodeGpuUtil("24h", "1h"),
    queryObsNodeEncoderUtil("24h", "1h"),
    queryObsNodePower("24h", "1h"),
    queryObsNodeNvencSessions("24h", "1h"),
    queryObsNodeNvencFps("24h", "1h"),
    queryObsNodeVram("24h", "1h"),
    queryObsNodeInstanceCount("24h", "1h"),
    queryObsNodeBandwidth("rx", "24h", "1h"),
    queryObsNodeBandwidth("tx", "24h", "1h"),
    queryObsNodeSnapshot(),
    queryObsInstanceSnapshot(),
    getRegisteredNodeIds("obs_nodes"),
    listNodesAction(),
  ]);

  // null (not []) keeps filterToRegistered permissive when the registry is down.
  const registeredIds = settled(registeredIdsRes, null, "obs registered ids");

  // Influx keeps points from deleted nodes until they age out of the range;
  // show only nodes that still exist in the registry, labeled by name.
  const nodeNames = new Map(fleet.map((n) => [n.id, n.name]));
  const show = <T extends { nodeId: string }>(result: PromiseSettledResult<T[]>, label: string) =>
    labelNodes(filterToRegistered(settled(result, [], label), registeredIds, (p) => p.nodeId), nodeNames);

  const nodeCpu: NodeMetricPoint[] = show(cpuRes, "obs node cpu");
  const nodeRam: NodeMetricPoint[] = show(ramRes, "obs node ram");
  const nodeGpu: NodeMetricPoint[] = show(gpuRes, "obs node gpu");
  const nodeEncoder: NodeMetricPoint[] = show(encoderRes, "obs node encoder");
  const nodePower: NodeMetricPoint[] = show(powerRes, "obs node power");
  const nodeNvencSessions: NodeMetricPoint[] = show(nvencSessionsRes, "obs node nvenc sessions");
  const nodeNvencFps: NodeMetricPoint[] = show(nvencFpsRes, "obs node nvenc fps");
  const nodeVram: NodeMetricPoint[] = show(vramRes, "obs node vram");
  const nodeInstanceCount: NodeMetricPoint[] = show(instanceCountRes, "obs node instance count");
  const nodeRx: NodeMetricPoint[] = show(rxRes, "obs node rx");
  const nodeTx: NodeMetricPoint[] = show(txRes, "obs node tx");
  const nodeSnapshot = show(snapshotRes, "obs node snapshot");
  const instanceSnapshot = show(instanceSnapshotRes, "obs instance snapshot");

  // Only the registry columns the list shows cross to the browser.
  const registry = registryRes.status === "fulfilled" ? (registryRes.value.data ?? []) : [];
  const facts: ObsNodeFacts[] = registry.map((n) => ({
    id: n.id,
    name: n.name,
    status: n.status,
    maintenance: n.maintenance,
    api_url: n.api_url,
    gpu_model: n.gpu_model,
    max_instances: n.max_instances,
  }));

  return (
    <>
      <ObsFleetOverview initial={{ fleet, nodeSnapshot, instanceSnapshot }} facts={facts} />

      <CollapsibleCharts>
        <section className="space-y-3">
          <SectionHeading icon={Cpu}>Host resources</SectionHeading>
          <ChartGrid>
            <NodeMetricChart title="CPU %" initialData={nodeCpu} apiPath={API_PATH} dataKey="nodeCpu" format="percent" />
            <NodeMetricChart title="RAM used (MB)" initialData={nodeRam} apiPath={API_PATH} dataKey="nodeRam" />
          </ChartGrid>
        </section>

        <section className="space-y-3">
          <SectionHeading icon={MonitorPlay}>GPU</SectionHeading>
          <ChartGrid>
            <NodeMetricChart title="Encoder (NVENC) utilization %" initialData={nodeEncoder} apiPath={API_PATH} dataKey="nodeEncoder" format="percent" />
            <NodeMetricChart title="Power draw (W)" initialData={nodePower} apiPath={API_PATH} dataKey="nodePower" />
            <NodeMetricChart title="GPU utilization % (time occupancy)" initialData={nodeGpu} apiPath={API_PATH} dataKey="nodeGpu" format="percent" />
            <NodeMetricChart title="VRAM used (MB)" initialData={nodeVram} apiPath={API_PATH} dataKey="nodeVram" />
            <NodeMetricChart title="NVENC sessions" initialData={nodeNvencSessions} apiPath={API_PATH} dataKey="nodeNvencSessions" />
            <NodeMetricChart title="NVENC encode FPS" initialData={nodeNvencFps} apiPath={API_PATH} dataKey="nodeNvencFps" />
          </ChartGrid>
        </section>

        <section className="space-y-3">
          <SectionHeading icon={Network}>Instances and bandwidth</SectionHeading>
          <ChartGrid>
            <NodeMetricChart title="Running instances" initialData={nodeInstanceCount} apiPath={API_PATH} dataKey="nodeInstanceCount" />
            <NodeMetricChart title="Bandwidth in" initialData={nodeRx} apiPath={API_PATH} dataKey="nodeRx" format="bytesPerSec" />
            <NodeMetricChart title="Bandwidth out" initialData={nodeTx} apiPath={API_PATH} dataKey="nodeTx" format="bytesPerSec" />
          </ChartGrid>
        </section>
      </CollapsibleCharts>
    </>
  );
}
