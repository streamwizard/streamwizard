import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getNodeAction, getInstanceAction } from "@/actions/nodes";
import { getAutoSwitcherConfigForUser } from "@/actions/auto-switcher";
import { InstanceDetailClient } from "@/components/admin/instance-detail-client";
import { InstanceSwitcherTab } from "@/components/admin/instance-switcher-tab";
import { NodeMetricChart, type NodeMetricPoint } from "@/components/charts/node-metric-chart";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import {
  queryObsInstanceCpu,
  queryObsInstanceRam,
  queryObsInstanceVram,
  queryObsInstanceRx,
  queryObsInstanceTx,
  type ObsInstanceMetricPoint,
} from "@repo/metrics";

export const dynamic = "force-dynamic";

function toNodePoints(points: ObsInstanceMetricPoint[]): NodeMetricPoint[] {
  return points.map((p) => ({ time: p.time, nodeId: "instance", value: p.value }));
}

export default async function InstanceDetailPage({
  params,
}: {
  params: Promise<{ nodeId: string; instanceId: string }>;
}) {
  const { nodeId, instanceId } = await params;

  const [{ data: node }, { data: instance }] = await Promise.all([getNodeAction(nodeId), getInstanceAction(instanceId)]);
  if (!node || !instance || instance.node_id !== nodeId) notFound();

  const apiPath = `/api/metrics/obs-instance/${instance.id}`;
  const empty: ObsInstanceMetricPoint[] = [];
  const [switcherConfig, cpuHist, ramHist, vramHist, rxHist, txHist] = await Promise.all([
    getAutoSwitcherConfigForUser(instance.user_id),
    queryObsInstanceCpu(instance.id, "24h", "1h").catch(() => empty),
    queryObsInstanceRam(instance.id, "24h", "1h").catch(() => empty),
    queryObsInstanceVram(instance.id, "24h", "1h").catch(() => empty),
    queryObsInstanceRx(instance.id, "24h", "1h").catch(() => empty),
    queryObsInstanceTx(instance.id, "24h", "1h").catch(() => empty),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href={`/obs/${nodeId}`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {node.name}
          </Link>
        </Button>
        <h1 className="text-2xl font-bold font-mono">{instance.container_name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{instance.owner_name ?? instance.owner_email ?? instance.user_id}</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics history</TabsTrigger>
          <TabsTrigger value="switcher">Auto Switcher</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <InstanceDetailClient node={node} instance={instance} />
        </TabsContent>

        <TabsContent value="metrics" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">Range and refresh follow the header controls.</p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <NodeMetricChart title="CPU %" initialData={toNodePoints(cpuHist)} apiPath={apiPath} dataKey="instanceCpu" format="percent" />
            <NodeMetricChart title="RAM Used (MB)" initialData={toNodePoints(ramHist)} apiPath={apiPath} dataKey="instanceRam" />
            <NodeMetricChart title="VRAM Used (MB)" initialData={toNodePoints(vramHist)} apiPath={apiPath} dataKey="instanceVram" />
            <NodeMetricChart title="Bandwidth In" initialData={toNodePoints(rxHist)} apiPath={apiPath} dataKey="instanceRx" format="bytesPerSec" />
            <NodeMetricChart title="Bandwidth Out" initialData={toNodePoints(txHist)} apiPath={apiPath} dataKey="instanceTx" format="bytesPerSec" />
          </div>
        </TabsContent>

        <TabsContent value="switcher" className="mt-4">
          <InstanceSwitcherTab
            userId={instance.user_id}
            instanceId={instance.id}
            apiUrl={node.api_url}
            instanceRunning={instance.status === "running"}
            initialConfig={switcherConfig}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
