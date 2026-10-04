import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Clock, Cpu, DatabaseBackup, Gauge, HardDrive, MemoryStick, Server } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@repo/ui";
import { STREAMWIZARD_VM_TAG, VM_ALERT_RULES, isStreamwizardVm } from "@repo/alerting/rules";
import { assertProxmoxName, queryProxmoxGuestInfo, type ProxmoxGuestInfo } from "@repo/metrics";
import { NodeMetricChart } from "@/components/charts/node-metric-chart";
import { relative } from "@/components/backups/backup-format";
import { When } from "@/components/backups/hint-popover";
import { PageHeader } from "@/components/widgets/page-header";
import { StatCard } from "@/components/widgets/stat-card";
import { StatGrid } from "@/components/widgets/stat-grid";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import { ChartSection } from "@/components/vms/chart-section";
import { VmAlertsCard } from "@/components/vms/vm-alerts-card";
import {
  AGENT_LABEL,
  HELD_ON_HOST_HINT,
  RAM_CACHE_HINT,
  formatPct,
  formatUptime,
  pctOf,
  usageTone,
  vmHostHref,
  vmStatusDisplay,
} from "@/components/vms/vm-format";
import { AutoRefresh } from "@/components/vms/auto-refresh";
import { formatBytes } from "@/lib/format";
import { getGuestNet, pveConfigured, type GuestRef } from "@/lib/pve";
import { fetchGuestSeries, getVm, guestRef } from "@/lib/vms";
import { PageCrumb } from "@/lib/crumbs";

export const dynamic = "force-dynamic";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm break-words">{children}</dd>
    </div>
  );
}

function Facts({ info }: { info: ProxmoxGuestInfo }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
      <Fact label="PVE status">{info.status ?? "—"}</Fact>
      <Fact label="QEMU status">{info.qmpstatus ?? "—"}</Fact>
      <Fact label="QEMU version">{info.qemuVersion ?? "—"}</Fact>
      <Fact label="Machine">{info.machine ?? "—"}</Fact>
      <Fact label="Lock">{info.lock ?? "none"}</Fact>
      <Fact label="Process">{info.pid != null ? `pid ${info.pid}` : "—"}</Fact>
    </dl>
  );
}

/** IPs and agent state from the PVE API, streamed in after the page. */
async function GuestNetLine({ guest }: { guest: GuestRef }) {
  if (!guest.running) return <p className="text-sm text-muted-foreground">Not running, no IPs.</p>;
  if (!pveConfigured()) return <p className="text-sm text-muted-foreground">IPs need PVE_HOSTS in this environment.</p>;
  const net = (await getGuestNet([guest]))[`${guest.host}:${guest.vmid}`];
  return (
    <p className="font-mono text-sm break-words">
      {net && net.ips.length > 0 ? net.ips.join(", ") : <span className="text-muted-foreground">No IPs known</span>}
      <span className="ml-2 font-sans text-muted-foreground">· {AGENT_LABEL[net?.agent ?? "off"] ?? net?.agent}</span>
    </p>
  );
}

/** Disk use from the guest agent (qemu) or Proxmox itself (lxc). */
async function DiskStat({ guest, lxcDisk }: { guest: GuestRef; lxcDisk: { used: number; total: number } | null }) {
  const agentDisk = lxcDisk || !guest.running ? null : (await getGuestNet([guest]))[`${guest.host}:${guest.vmid}`]?.disk;
  const disk = lxcDisk ?? (agentDisk ? { used: agentDisk.usedBytes, total: agentDisk.totalBytes } : null);
  const pct = disk ? pctOf(disk.used, disk.total) : null;
  return (
    <StatCard
      title="Disk"
      value={formatPct(pct)}
      description={disk ? `${formatBytes(disk.used)} of ${formatBytes(disk.total)}, ${formatBytes(disk.total - disk.used)} free` : guest.type === "qemu" ? "Needs the guest agent" : "Not reported"}
      tone={usageTone(pct)}
      icon={HardDrive}
    />
  );
}

// The charts share the page with the Alerts column until 1280px, so two per row only fits from there.
const CHART_COLUMNS = "lg:grid-cols-1 xl:grid-cols-2";

export default async function VmDetailPage({ params }: { params: Promise<{ host: string; vmid: string }> }) {
  const { host: rawHost, vmid: rawVmid } = await params;
  const host = safeDecode(rawHost);
  const vmid = Number(rawVmid);
  if (!Number.isInteger(vmid) || vmid <= 0) notFound();
  try {
    assertProxmoxName(host, "host");
  } catch {
    notFound();
  }

  const vm = await getVm(host, vmid);
  if (!vm) notFound();

  const [info, series] = await Promise.all([
    queryProxmoxGuestInfo(host, vmid).catch((error) => {
      console.error("[vm info]", error);
      return null;
    }),
    fetchGuestSeries(host, vmid, "24h", "1h"),
  ]);

  const { guest, metrics, alertRules: enabled, stale } = vm;
  const ref = guestRef(vm);
  const api = `/api/metrics/vms?host=${encodeURIComponent(host)}&vmid=${vmid}`;
  const status = vmStatusDisplay(guest.status || "unknown");
  const running = ref.running;
  const lxcDisk = guest.type === "lxc" && metrics?.diskUsed != null && metrics.diskMax ? { used: metrics.diskUsed, total: metrics.diskMax } : null;
  const memPct = pctOf(metrics?.memUsed, metrics?.memMax);
  const cpus = metrics?.cpus ?? info?.cpus ?? null;
  const ballooning = metrics?.balloon != null && metrics.memMax != null && metrics.balloon < metrics.memMax;
  const hasBalloonStats = series.swap.length > 0 || series.pageFaults.length > 0;

  const name = guest.name || `VM ${guest.vmid}`;

  // One column on a phone, in the order that matters there: status, alert
  // switches, stats, facts, charts. From 1024px `order` is off and the page is
  // back in source order, with the Alerts card as the column beside the charts.
  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh />
      <PageCrumb label={name} href={`/vms/${encodeURIComponent(host)}/${guest.vmid}`} />
      <div className="order-1 space-y-2 lg:order-none">
        <PageHeader title={name} description={`${guest.type}/${guest.vmid}`}>
          <Button asChild variant="outline" size="sm" className="h-11 md:h-8">
            <Link href={`/backups/${guest.vmid}`}>
              <DatabaseBackup aria-hidden="true" />
              Backups
            </Link>
          </Button>
        </PageHeader>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <StatusIndicator status={status.indicator} label={status.label} />
          {info?.lock && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
              Locked: {info.lock}
            </Badge>
          )}
          {guest.tags.map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          On{" "}
          <Link href={vmHostHref(guest.nodename)} className="font-mono underline underline-offset-4">
            {guest.nodename}
          </Link>{" "}
          · last report <When iso={guest.time} label={relative(guest.time)} className={stale ? "text-amber-600 dark:text-amber-400" : undefined} />
        </p>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading IPs…</p>}>
          <GuestNetLine guest={ref} />
        </Suspense>
      </div>

      {info && (
        <Card className="order-4 lg:order-none">
          <CardContent className="px-4 py-4 sm:px-6">
            <Facts info={info} />
          </CardContent>
        </Card>
      )}

      <StatGrid cols={6} className="order-3 lg:order-none">
        <StatCard title="Uptime" value={running ? formatUptime(metrics?.uptimeS) : "—"} icon={Clock} />
        <StatCard
          title="CPU"
          value={running ? formatPct(metrics?.cpuPct) : "—"}
          description={cpus != null ? `of ${cpus} vCPU` : undefined}
          tone={running ? usageTone(metrics?.cpuPct) : "default"}
          icon={Cpu}
        />
        <StatCard
          title="RAM (incl. cache)"
          hint={RAM_CACHE_HINT}
          value={running ? formatPct(memPct) : "—"}
          description={running && metrics?.memUsed != null ? `${formatBytes(metrics.memUsed)} of ${formatBytes(metrics.memMax)}` : undefined}
          tone={running ? usageTone(memPct, 90, 97) : "default"}
          icon={MemoryStick}
        />
        <StatCard
          title="Held on host"
          hint={HELD_ON_HOST_HINT}
          value={running && metrics?.memHost != null ? formatBytes(metrics.memHost) : "—"}
          description={ballooning ? `Balloon target ${formatBytes(metrics!.balloon)}` : undefined}
          icon={Server}
        />
        <Suspense fallback={<StatCard title="Disk" value="…" icon={HardDrive} />}>
          <DiskStat guest={ref} lxcDisk={lxcDisk} />
        </Suspense>
        <StatCard
          title="IO pressure"
          hint="Share of time at least one task waited on disk IO (PSI some)."
          value={running ? formatPct(metrics?.pressureIo) : "—"}
          description={running && metrics ? `CPU ${formatPct(metrics.pressureCpu)} · RAM ${formatPct(metrics.pressureMem)}` : undefined}
          tone={running ? usageTone(metrics?.pressureIo, 20, 40) : "default"}
          icon={Gauge}
        />
      </StatGrid>

      {/* `contents` on a phone lifts both columns into the page's own column, so `order` can place them. */}
      <div className="contents lg:grid lg:grid-cols-3 lg:gap-6">
        <div className="order-5 space-y-6 lg:order-none lg:col-span-2">
          <ChartSection title="CPU and memory" gridClassName={CHART_COLUMNS}>
            <NodeMetricChart title="CPU %" apiPath={api} dataKey="cpu" initialData={series.cpu} format="percent" />
            <NodeMetricChart title="RAM" apiPath={api} dataKey="memory" initialData={series.memory} format="bytes" />
          </ChartSection>

          <ChartSection
            title="Pressure"
            hint="Share of time tasks waited on CPU, IO or memory. Some = at least one task, full = all of them."
            gridClassName={CHART_COLUMNS}
          >
            <NodeMetricChart title="CPU pressure" apiPath={api} dataKey="pressureCpu" initialData={series.pressureCpu} format="percent" />
            <NodeMetricChart title="IO pressure" apiPath={api} dataKey="pressureIo" initialData={series.pressureIo} format="percent" />
            <NodeMetricChart title="Memory pressure" apiPath={api} dataKey="pressureMemory" initialData={series.pressureMemory} format="percent" />
          </ChartSection>

          <ChartSection title="Network" gridClassName={CHART_COLUMNS}>
            <NodeMetricChart title="Network, all NICs" apiPath={api} dataKey="net" initialData={series.net} format="bytesPerSec" />
            <NodeMetricChart title="Network per NIC" apiPath={api} dataKey="nics" initialData={series.nics} format="bytesPerSec" />
          </ChartSection>

          <ChartSection title="Disks" hint="Drives with no reads or writes in the range are left out." gridClassName={CHART_COLUMNS}>
            <NodeMetricChart title="Disk IO, all drives" apiPath={api} dataKey="diskIo" initialData={series.diskIo} format="bytesPerSec" />
            <NodeMetricChart title="Throughput per drive" apiPath={api} dataKey="driveBytes" initialData={series.driveBytes} format="bytesPerSec" />
            <NodeMetricChart title="IOPS per drive" apiPath={api} dataKey="driveIops" initialData={series.driveIops} format="perSec" />
            <NodeMetricChart title="Latency per drive" apiPath={api} dataKey="driveLatency" initialData={series.driveLatency} format="latencyMs" />
          </ChartSection>

          {hasBalloonStats && (
            <ChartSection title="Inside the guest" hint="From the balloon driver's stats." gridClassName={CHART_COLUMNS}>
              <NodeMetricChart title="Swap in / out" apiPath={api} dataKey="swap" initialData={series.swap} format="bytesPerSec" />
              <NodeMetricChart title="Page faults" apiPath={api} dataKey="pageFaults" initialData={series.pageFaults} format="perSec" />
            </ChartSection>
          )}
        </div>

        <div className="order-2 lg:order-none">
          {isStreamwizardVm(guest.tags) ? (
            <VmAlertsCard host={host} vmid={vmid} rules={VM_ALERT_RULES} initialEnabled={enabled} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Add the tag <code className="font-mono">{STREAMWIZARD_VM_TAG}</code> in Proxmox to enable alerts.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
