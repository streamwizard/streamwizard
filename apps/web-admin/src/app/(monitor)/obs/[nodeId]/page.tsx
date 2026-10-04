import { notFound } from "next/navigation";
import { getNodeAction } from "@/actions/nodes";
import { NodeDetailClient } from "@/components/admin/node-detail-client";
import { NodeMetricChart, type NodeMetricPoint } from "@/components/charts/node-metric-chart";
import {
  queryObsNodeCpu,
  queryObsNodeRam,
  queryObsNodeGpuUtil,
  queryObsNodeEncoderUtil,
  queryObsNodeVram,
  queryObsNodeBandwidth,
} from "@repo/metrics";
import { History } from "lucide-react";
import { CollapsibleCharts } from "@/components/admin/collapsible-charts";
import { SectionHeading } from "@/components/widgets/section-heading";
import { ChartGrid } from "@/components/widgets/stat-grid";
import { PageCrumb } from "@/lib/crumbs";

export const dynamic = "force-dynamic";

export default async function NodeDetailPage({ params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;

  const { data: node } = await getNodeAction(nodeId);
  if (!node) notFound();

  // History series come from the fleet-wide obs_node measurement; keep only
  // this node's points. The chart's SWR refresh reuses the fleet API payload,
  // where labeling renames nodeId to the node *name* — filter on both.
  const empty: NodeMetricPoint[] = [];
  const only = (points: NodeMetricPoint[]) => points.filter((p) => p.nodeId === node.id);
  const [cpuHist, ramHist, gpuHist, encoderHist, vramHist, rxHist, txHist] = await Promise.all([
    queryObsNodeCpu("24h", "1h").then(only).catch(() => empty),
    queryObsNodeRam("24h", "1h").then(only).catch(() => empty),
    queryObsNodeGpuUtil("24h", "1h").then(only).catch(() => empty),
    queryObsNodeEncoderUtil("24h", "1h").then(only).catch(() => empty),
    queryObsNodeVram("24h", "1h").then(only).catch(() => empty),
    queryObsNodeBandwidth("rx", "24h", "1h").then(only).catch(() => empty),
    queryObsNodeBandwidth("tx", "24h", "1h").then(only).catch(() => empty),
  ]);
  const filterIds = [node.id, node.name];

  return (
    <div className="space-y-6">
      <PageCrumb label={node.name} href={`/obs/${nodeId}`} />
      <NodeDetailClient node={node} />

      <section className="space-y-3">
        <SectionHeading icon={History}>History</SectionHeading>
        <CollapsibleCharts>
          <ChartGrid>
            <NodeMetricChart title="CPU %" initialData={cpuHist} apiPath="/api/metrics/obs" dataKey="nodeCpu" format="percent" filterNodeIds={filterIds} />
            <NodeMetricChart title="RAM used (MB)" initialData={ramHist} apiPath="/api/metrics/obs" dataKey="nodeRam" filterNodeIds={filterIds} />
            <NodeMetricChart title="GPU utilization %" initialData={gpuHist} apiPath="/api/metrics/obs" dataKey="nodeGpu" format="percent" filterNodeIds={filterIds} />
            <NodeMetricChart title="Encoder (NVENC) %" initialData={encoderHist} apiPath="/api/metrics/obs" dataKey="nodeEncoder" format="percent" filterNodeIds={filterIds} />
            <NodeMetricChart title="VRAM used (MB)" initialData={vramHist} apiPath="/api/metrics/obs" dataKey="nodeVram" filterNodeIds={filterIds} />
            <NodeMetricChart title="Bandwidth in" initialData={rxHist} apiPath="/api/metrics/obs" dataKey="nodeRx" format="bytesPerSec" filterNodeIds={filterIds} />
            <NodeMetricChart title="Bandwidth out" initialData={txHist} apiPath="/api/metrics/obs" dataKey="nodeTx" format="bytesPerSec" filterNodeIds={filterIds} />
          </ChartGrid>
        </CollapsibleCharts>
      </section>
    </div>
  );
}
