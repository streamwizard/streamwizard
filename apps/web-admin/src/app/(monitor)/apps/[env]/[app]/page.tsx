import { notFound } from "next/navigation";
import { Activity, Cpu, MemoryStick, Network, RotateCcw, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { assertAppName, isAppEnv } from "@repo/metrics";
import {
  CPU_HINT,
  MEMORY_HINT,
  REQUESTS_HINT,
  RESPONSE_HINT,
  STARTS_HINT,
  appHref,
  errorTone,
  formatCpu,
  formatErrorPct,
  formatMs,
  formatPerSec,
  healthDisplay,
} from "@/components/apps/app-format";
import { AppsNotice, MissingData } from "@/components/apps/apps-notice";
import { ContainerList } from "@/components/apps/container-list";
import { relative } from "@/components/backups/backup-format";
import { When } from "@/components/backups/hint-popover";
import { NodeMetricChart } from "@/components/charts/node-metric-chart";
import { AutoRefresh } from "@/components/vms/auto-refresh";
import { ChartSection } from "@/components/vms/chart-section";
import { Rate } from "@/components/vms/rate";
import { PageHeader } from "@/components/widgets/page-header";
import { StatCard } from "@/components/widgets/stat-card";
import { StatGrid } from "@/components/widgets/stat-grid";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import { fetchAppSeries, getApp } from "@/lib/apps";
import { ENV_LABEL } from "@/lib/apps-model";
import { PageCrumb } from "@/lib/crumbs";
import { formatBytes } from "@/lib/format";

export const dynamic = "force-dynamic";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function AppDetailPage({ params }: { params: Promise<{ env: string; app: string }> }) {
  const { env, app: rawApp } = await params;
  const app = safeDecode(rawApp);
  if (!isAppEnv(env)) notFound();
  try {
    assertAppName(app);
  } catch {
    notFound();
  }

  const href = appHref(env, app);
  const [detail, series] = await Promise.all([getApp(env, app), fetchAppSeries(env, app, "24h", "1h")]);
  if (detail.state === "unknown") notFound();

  if (detail.state !== "ok") {
    return (
      <div className="space-y-6">
        <PageCrumb label={app} href={href} />
        <PageHeader title={app} description={ENV_LABEL[env]} />
        <AppsNotice state={detail.state} />
      </div>
    );
  }

  const { row, containers, liveNames, failed } = detail;
  const health = healthDisplay(row);
  const api = `/api/metrics/apps?env=${env}&app=${encodeURIComponent(app)}`;
  const routed = row.requestsPerSec !== null || series.requests.length > 0;

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <PageCrumb label={app} href={href} />
      <div className="space-y-2">
        <PageHeader title={app} description={row.service && row.service !== app ? `${ENV_LABEL[env]} · ${row.service}` : ENV_LABEL[env]} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <StatusIndicator status={env === "other" ? "muted" : health.indicator} label={health.label} />
          {row.lastSeen && (
            <span className="text-sm text-muted-foreground">
              last report <When iso={row.lastSeen} label={relative(row.lastSeen)} className={row.stale ? "text-amber-600 dark:text-amber-400" : undefined} />
            </span>
          )}
        </div>
        {row.health === "nodata" && <p className="text-sm text-muted-foreground">Telegraf has nothing on this app. It is not on the server, or its name there changed.</p>}
      </div>
      <MissingData failed={failed} />

      <StatGrid cols={6}>
        <StatCard title="CPU" hint={CPU_HINT} value={formatCpu(row.cpuPct)} icon={Cpu} />
        <StatCard title="Memory" hint={MEMORY_HINT} value={row.memBytes == null ? "—" : formatBytes(row.memBytes)} icon={MemoryStick} />
        <StatCard
          title="Network in"
          value={<Rate bps={row.netRxBps} />}
          description={
            <>
              Out <Rate bps={row.netTxBps} />
            </>
          }
          icon={Network}
        />
        <StatCard
          title="Starts, 24 h"
          hint={STARTS_HINT}
          value={row.health === "nodata" ? "—" : row.starts}
          description={row.failed > 0 ? `${row.failed} failed${row.oomKills > 0 ? `, ${row.oomKills} out of memory` : ""}` : undefined}
          tone={row.failed > 0 && env !== "other" ? "danger" : "default"}
          icon={RotateCcw}
        />
        <StatCard
          title="Requests"
          hint={REQUESTS_HINT}
          value={formatPerSec(row.requestsPerSec)}
          description={row.errorPct == null ? undefined : `${formatErrorPct(row.errorPct)} errors`}
          tone={env === "other" ? "default" : errorTone(row.errorPct)}
          icon={Activity}
        />
        <StatCard title="Response time" hint={RESPONSE_HINT} value={formatMs(row.meanMs)} icon={Timer} />
      </StatGrid>

      <ChartSection title="CPU and memory">
        <NodeMetricChart title="CPU, % of one core" apiPath={api} dataKey="cpu" initialData={series.cpu} format="percent" />
        <NodeMetricChart title="Memory" apiPath={api} dataKey="memory" initialData={series.memory} format="bytes" />
      </ChartSection>

      <ChartSection title="Network and disk">
        <NodeMetricChart title="Network" apiPath={api} dataKey="network" initialData={series.network} format="bytesPerSec" />
        <NodeMetricChart title="Disk IO" apiPath={api} dataKey="disk" initialData={series.disk} format="bytesPerSec" />
      </ChartSection>

      {routed && (
        <ChartSection title="Requests" hint="From Traefik, in front of the app.">
          <NodeMetricChart title="Requests per second, by status" apiPath={api} dataKey="requests" initialData={series.requests} format="perSec" />
          <NodeMetricChart title="Mean response time" apiPath={api} dataKey="responseMs" initialData={series.responseMs} format="latencyMs" />
        </ChartSection>
      )}

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base">Containers, last 24 hours</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ContainerList containers={containers} liveNames={liveNames} />
        </CardContent>
      </Card>
    </div>
  );
}
