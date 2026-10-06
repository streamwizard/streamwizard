import { Activity, Clock, Cpu, HardDrive, MemoryStick, Skull } from "lucide-react";
import { SERVER_HREF } from "@/components/apps/app-format";
import { AppsNotice, MissingData } from "@/components/apps/apps-notice";
import { relative } from "@/components/backups/backup-format";
import { When } from "@/components/backups/hint-popover";
import { NodeMetricChart } from "@/components/charts/node-metric-chart";
import { AutoRefresh } from "@/components/vms/auto-refresh";
import { ChartSection } from "@/components/vms/chart-section";
import { formatLoad, formatPct, formatUptime, hostStatusDisplay, usageTone } from "@/components/vms/vm-format";
import { PageHeader } from "@/components/widgets/page-header";
import { StatCard } from "@/components/widgets/stat-card";
import { StatGrid } from "@/components/widgets/stat-grid";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import { fetchServerSeries, getServer } from "@/lib/apps";
import { PageCrumb } from "@/lib/crumbs";
import { formatBytes } from "@/lib/format";

export const dynamic = "force-dynamic";

const API = "/api/metrics/apps?server=1";
const DESCRIPTION = "The Dokploy server that runs production and staging: CPU, memory, disk and network.";

export default async function ServerPage() {
  const [detail, series] = await Promise.all([getServer(), fetchServerSeries("24h", "1h")]);

  if (detail.state !== "ok") {
    return (
      <div className="space-y-6">
        {detail.state !== "not-collected" && <AutoRefresh />}
        <PageCrumb label="Server" href={SERVER_HREF} />
        <PageHeader title="Server" description={DESCRIPTION} />
        <AppsNotice state={detail.state} />
      </div>
    );
  }

  const { snapshot: s, stale, oomKills24h } = detail.server;
  const status = hostStatusDisplay(stale);
  const name = s.host || "Server";

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <PageCrumb label={name} href={SERVER_HREF} />
      <div className="space-y-2">
        <PageHeader title={name} description={DESCRIPTION} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <StatusIndicator status={status.indicator} label={status.label} />
          <span className="text-sm text-muted-foreground">
            last report <When iso={s.time} label={relative(s.time)} className={stale ? "text-red-600 dark:text-red-400" : undefined} />
          </span>
        </div>
      </div>
      <MissingData failed={detail.failed} />

      <StatGrid cols={6}>
        <StatCard
          title="CPU"
          value={formatPct(s.cpuPct)}
          description={s.cpus != null ? `of ${s.cpus} cores · ${formatPct(s.iowaitPct)} waiting on disk` : undefined}
          tone={usageTone(s.cpuPct)}
          icon={Cpu}
        />
        <StatCard
          title="Memory"
          value={formatPct(s.memUsedPct)}
          description={s.memUsed != null ? `${formatBytes(s.memUsed)} of ${formatBytes(s.memTotal)}` : undefined}
          tone={usageTone(s.memUsedPct, 90, 97)}
          icon={MemoryStick}
        />
        <StatCard
          title="Disk /"
          value={formatPct(s.diskUsedPct)}
          description={s.diskUsed != null ? `${formatBytes(s.diskUsed)} of ${formatBytes(s.diskTotal)} · inodes ${formatPct(s.inodesUsedPct)}` : undefined}
          tone={usageTone(s.diskUsedPct, 80, 90)}
          icon={HardDrive}
        />
        <StatCard
          title="Load, 1 min"
          hint="Tasks running or waiting for a core. Around the core count means the CPUs are full."
          value={formatLoad(s.load1)}
          description={`5 min ${formatLoad(s.load5)} · 15 min ${formatLoad(s.load15)}`}
          icon={Activity}
        />
        <StatCard
          title="OOM kills, 24 h"
          hint="Processes the kernel killed because the server ran out of memory."
          value={oomKills24h ?? "—"}
          description={`Swap ${formatPct(s.swapUsedPct)}`}
          tone={oomKills24h ? "danger" : "default"}
          icon={Skull}
        />
        <StatCard title="Uptime" value={formatUptime(s.uptimeSeconds)} description={s.containersRunning != null ? `${s.containersRunning} containers running` : undefined} icon={Clock} />
      </StatGrid>

      <ChartSection title="CPU and load">
        <NodeMetricChart title="CPU, % of all cores" apiPath={API} dataKey="cpu" initialData={series.cpu} format="percent" />
        <NodeMetricChart title="Load" apiPath={API} dataKey="load" initialData={series.load} format="decimal" />
      </ChartSection>

      <ChartSection title="Memory">
        <NodeMetricChart title="Memory %" apiPath={API} dataKey="memory" initialData={series.memory} format="percent" />
        <NodeMetricChart title="Swap %" apiPath={API} dataKey="swap" initialData={series.swap} format="percent" />
        <NodeMetricChart title="OOM kills" apiPath={API} dataKey="oomKills" initialData={series.oomKills} format="number" />
      </ChartSection>

      <ChartSection title="Disk and network">
        <NodeMetricChart title="Disk / %" apiPath={API} dataKey="disk" initialData={series.disk} format="percent" />
        <NodeMetricChart title="Disk IO, all disks" apiPath={API} dataKey="diskIo" initialData={series.diskIo} format="bytesPerSec" />
        <NodeMetricChart title="Network" apiPath={API} dataKey="network" initialData={series.network} format="bytesPerSec" />
      </ChartSection>
    </div>
  );
}
