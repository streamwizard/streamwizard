import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Clock, Cpu, Gauge, HardDrive, MemoryStick, Server } from "lucide-react";
import { Badge, Card, CardContent } from "@repo/ui";
import { STREAMWIZARD_VM_TAG, VM_ALERT_RULES, isStreamwizardVm } from "@repo/alerting/rules";
import { assertProxmoxName, queryProxmoxGuestInfo, type ProxmoxGuestInfo } from "@repo/metrics";
import { NodeMetricChart } from "@/components/charts/node-metric-chart";
import { formatWhen, relative } from "@/components/backups/backup-format";
import { StatCard } from "@/components/widgets/stat-card";
import { StatusIndicator } from "@/components/widgets/status-indicator";
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
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm">{children}</dd>
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
  if (!guest.running) return <p className="mt-1 text-sm text-muted-foreground">Not running, no IPs.</p>;
  if (!pveConfigured()) return <p className="mt-1 text-sm text-muted-foreground">IPs need PVE_HOSTS in this environment.</p>;
  const net = (await getGuestNet([guest]))[`${guest.host}:${guest.vmid}`];
  return (
    <p className="mt-1 font-mono text-sm">
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

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{children}</div>
    </section>
  );
}

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

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <PageCrumb label={guest.name || `VM ${guest.vmid}`} href={`/vms/${encodeURIComponent(host)}/${guest.vmid}`} />
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{guest.name || `VM ${guest.vmid}`}</h1>
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
        <p className="mt-1 text-sm text-muted-foreground">
          <Link href={vmHostHref(guest.nodename)} className="font-mono hover:underline">
            {guest.nodename}
          </Link>{" "}
          · <span className="font-mono">{guest.type}/{guest.vmid}</span> · last report{" "}
          <span title={formatWhen(guest.time)} className={stale ? "text-amber-600 dark:text-amber-400" : undefined}>
            {relative(guest.time)}
          </span>
        </p>
        <Suspense fallback={<p className="mt-1 text-sm text-muted-foreground">Loading IPs…</p>}>
          <GuestNetLine guest={ref} />
        </Suspense>
      </div>

      {info && (
        <Card>
          <CardContent className="py-4">
            <Facts info={info} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <p className="text-sm text-muted-foreground">Range and refresh follow the header controls.</p>

          <Section title="CPU and memory">
            <NodeMetricChart title="CPU %" apiPath={api} dataKey="cpu" initialData={series.cpu} format="percent" />
            <NodeMetricChart title="RAM" apiPath={api} dataKey="memory" initialData={series.memory} format="bytes" />
          </Section>

          <Section title="Pressure" hint="Share of time tasks waited on CPU, IO or memory. Some = at least one task, full = all of them.">
            <NodeMetricChart title="CPU pressure" apiPath={api} dataKey="pressureCpu" initialData={series.pressureCpu} format="percent" />
            <NodeMetricChart title="IO pressure" apiPath={api} dataKey="pressureIo" initialData={series.pressureIo} format="percent" />
            <NodeMetricChart title="Memory pressure" apiPath={api} dataKey="pressureMemory" initialData={series.pressureMemory} format="percent" />
          </Section>

          <Section title="Network">
            <NodeMetricChart title="Network, all NICs" apiPath={api} dataKey="net" initialData={series.net} format="bytesPerSec" />
            <NodeMetricChart title="Network per NIC" apiPath={api} dataKey="nics" initialData={series.nics} format="bytesPerSec" />
          </Section>

          <Section title="Disks" hint="Drives with no reads or writes in the range are left out.">
            <NodeMetricChart title="Disk IO, all drives" apiPath={api} dataKey="diskIo" initialData={series.diskIo} format="bytesPerSec" />
            <NodeMetricChart title="Throughput per drive" apiPath={api} dataKey="driveBytes" initialData={series.driveBytes} format="bytesPerSec" />
            <NodeMetricChart title="IOPS per drive" apiPath={api} dataKey="driveIops" initialData={series.driveIops} format="perSec" />
            <NodeMetricChart title="Latency per drive" apiPath={api} dataKey="driveLatency" initialData={series.driveLatency} format="latencyMs" />
          </Section>

          {hasBalloonStats && (
            <Section title="Inside the guest" hint="From the balloon driver's stats.">
              <NodeMetricChart title="Swap in / out" apiPath={api} dataKey="swap" initialData={series.swap} format="bytesPerSec" />
              <NodeMetricChart title="Page faults" apiPath={api} dataKey="pageFaults" initialData={series.pageFaults} format="perSec" />
            </Section>
          )}
        </div>

        <div className="space-y-6">
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
