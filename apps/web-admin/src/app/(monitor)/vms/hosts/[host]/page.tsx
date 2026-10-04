import { notFound } from "next/navigation";
import { Clock, Cpu, Database, Gauge, HardDrive, MemoryStick, Server } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { STREAMWIZARD_VM_TAG, VM_ALERT_RULES } from "@repo/alerting/rules";
import { assertProxmoxName } from "@repo/metrics";
import { NodeMetricChart } from "@/components/charts/node-metric-chart";
import { relative } from "@/components/backups/backup-format";
import { When } from "@/components/backups/hint-popover";
import { DataList } from "@/components/widgets/data-list";
import { PageHeader } from "@/components/widgets/page-header";
import { StatCard } from "@/components/widgets/stat-card";
import { StatGrid } from "@/components/widgets/stat-grid";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import { ChartSection } from "@/components/vms/chart-section";
import { HostNicChart } from "@/components/vms/host-nic-chart";
import { OtherVms } from "@/components/vms/other-vms";
import { UsageMeter } from "@/components/vms/usage-meter";
import { VmTable } from "@/components/vms/vm-table";
import { formatLoad, formatPct, formatUptime, hostStatusDisplay, pctOf, usageTone } from "@/components/vms/vm-format";
import { AutoRefresh } from "@/components/vms/auto-refresh";
import { formatBytes } from "@/lib/format";
import { getGuestNet } from "@/lib/pve";
import { fetchHostSeries, getVmOverview, guestRef, splitVms, toTableRow } from "@/lib/vms";
import { PageCrumb } from "@/lib/crumbs";

export const dynamic = "force-dynamic";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function HostDetailPage({ params }: { params: Promise<{ host: string }> }) {
  const { host: rawHost } = await params;
  const name = safeDecode(rawHost);
  try {
    assertProxmoxName(name, "host");
  } catch {
    notFound();
  }

  const [overview, series] = await Promise.all([getVmOverview(name), fetchHostSeries(name, "24h", "1h")]);
  const host = overview.hosts[0];
  if (!host) notFound();

  const { metrics: m, storages, vmHeldBytes } = host;
  const api = `/api/metrics/vms?host=${encodeURIComponent(name)}`;
  const s = hostStatusDisplay(host.stale);
  const memPct = pctOf(m?.memUsed, m?.memTotal);
  const swapPct = pctOf(m?.swapUsed, m?.swapTotal);
  const rootPct = pctOf(m?.rootUsed, m?.rootTotal);
  const runningVms = overview.vms.filter((v) => guestRef(v).running);
  const running = runningVms.length;
  const { ours, others } = splitVms(overview.vms);
  const assigned = runningVms.reduce((sum, v) => sum + (v.metrics?.memMax ?? 0), 0);
  // Not awaited: the tables render now, IPs, agent state and disk stream in.
  const net = getGuestNet(overview.vms.map(guestRef));

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <PageCrumb label={host.name} href={`/vms/hosts/${encodeURIComponent(host.name)}`} />
      <div className="space-y-2">
        <PageHeader title={host.name} description={`Proxmox host · ${running} of ${overview.vms.length} guests running`} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <StatusIndicator status={s.indicator} label={s.label} className="text-foreground" />
          <span>
            Last report <When iso={host.lastSeen} label={relative(host.lastSeen)} className={host.stale ? "text-red-600 dark:text-red-400" : undefined} />
          </span>
        </div>
      </div>

      <StatGrid cols={6}>
        <StatCard title="Uptime" value={formatUptime(m?.uptimeS)} icon={Clock} />
        <StatCard
          title="CPU"
          value={formatPct(m?.cpuPct)}
          description={m ? `${m.cpus ?? "?"} cores · IO wait ${formatPct(m.iowaitPct)}` : undefined}
          tone={usageTone(m?.cpuPct)}
          icon={Cpu}
        />
        <StatCard
          title="Load"
          value={formatLoad(m?.load1)}
          description={m ? `5 min ${formatLoad(m.load5)} · 15 min ${formatLoad(m.load15)}` : undefined}
          icon={Gauge}
        />
        <StatCard
          title="RAM"
          hint="Used = total minus available, so page cache doesn't count."
          value={formatPct(memPct)}
          description={m ? `${formatBytes(m.memUsed)} of ${formatBytes(m.memTotal)} · ${formatBytes(m.memAvailable)} available` : undefined}
          tone={usageTone(memPct, 90, 97)}
          icon={MemoryStick}
        />
        <StatCard
          title="RAM held by VMs"
          hint="What the running guests' QEMU processes hold on this host, added up."
          value={vmHeldBytes != null ? formatBytes(vmHeldBytes) : "—"}
          description={assigned > 0 ? `${formatBytes(assigned)} assigned to running guests` : undefined}
          icon={Server}
        />
        <StatCard
          title="Swap"
          value={m?.swapTotal ? formatPct(swapPct) : "—"}
          description={m?.swapTotal ? `${formatBytes(m.swapUsed)} of ${formatBytes(m.swapTotal)}` : "No swap"}
          tone={usageTone(swapPct, 50, 80)}
          icon={Database}
        />
      </StatGrid>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <HardDrive className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Root disk
              </span>
              <span className="tabular-nums">{formatPct(rootPct)}</span>
            </div>
            <UsageMeter pct={rootPct} label="Root disk used" className="h-2" />
            <p className="text-xs text-muted-foreground">
              {m?.rootTotal ? `${formatBytes(m.rootUsed)} of ${formatBytes(m.rootTotal)} · ${formatBytes(m.rootAvail)} free` : "Not reported"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <MemoryStick className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                ZFS ARC
              </span>
              <span className="tabular-nums">{m?.arcSize != null ? formatBytes(m.arcSize) : "—"}</span>
            </div>
            <UsageMeter pct={pctOf(m?.arcSize, m?.arcMax)} label="ZFS ARC size of max" warn={101} crit={101} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {!m?.arcMax
                ? "Not reported"
                : (m.arcSize ?? 0) < 1024 * 1024
                  ? "Empty, so no ZFS pool is in use."
                  : `Max ${formatBytes(m.arcMax)}. Counts as used RAM but shrinks when guests need it.`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base">Storages</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {storages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No storages reported.</p>
          ) : (
            <DataList
              rows={storages}
              rowKey={(st) => st.key}
              columns={[
                { key: "storage", header: "Storage", mobile: "title", className: "font-medium", cell: (st) => st.storage },
                {
                  key: "state",
                  header: "State",
                  mobile: "badge",
                  className: "whitespace-nowrap",
                  cell: (st) => (
                    <div className="flex gap-1">
                      {!st.enabled ? (
                        <Badge variant="outline">Disabled</Badge>
                      ) : st.active ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="border-red-500/50 text-red-600 dark:text-red-400">
                          Inactive
                        </Badge>
                      )}
                      {st.shared && <Badge variant="outline">Shared</Badge>}
                    </div>
                  ),
                },
                { key: "type", header: "Type", className: "font-mono text-xs", cell: (st) => <span className="font-mono text-xs">{st.type}</span> },
                {
                  key: "content",
                  header: "Content",
                  className: "text-xs whitespace-normal text-muted-foreground",
                  cell: (st) => st.content?.split(",").join(", ") ?? "—",
                },
                {
                  key: "used",
                  header: "Used",
                  headClassName: "text-right",
                  className: "text-right tabular-nums whitespace-nowrap",
                  cell: (st) => (
                    <span className="tabular-nums">
                      {formatBytes(st.used)} / {formatBytes(st.total)}
                    </span>
                  ),
                },
                {
                  key: "free",
                  header: "Free",
                  headClassName: "text-right",
                  className: "text-right tabular-nums whitespace-nowrap",
                  cell: (st) => <span className="tabular-nums">{formatBytes(st.avail)}</span>,
                },
                {
                  key: "usage",
                  header: "Usage",
                  headClassName: "w-48",
                  cell: (st) => {
                    const p = pctOf(st.used, st.total);
                    return (
                      <div className="flex items-center gap-2">
                        <UsageMeter pct={p} label={`${st.storage} used`} className="flex-1" />
                        <span className="w-10 text-right text-xs tabular-nums">{formatPct(p)}</span>
                      </div>
                    );
                  },
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base">StreamWizard VMs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <VmTable
            rows={ours.map(toTableRow)}
            ruleCount={VM_ALERT_RULES.length}
            showHost={false}
            net={net}
            emptyText={`No VMs tagged ${STREAMWIZARD_VM_TAG} on this host.`}
          />
        </CardContent>
      </Card>

      <OtherVms rows={others.map(toTableRow)} showHost={false} net={net} />

      <ChartSection title="CPU">
        <NodeMetricChart title="CPU %" apiPath={api} dataKey="cpu" initialData={series.cpu} format="percent" />
        <NodeMetricChart title="CPU time by kind" apiPath={api} dataKey="cpuBreakdown" initialData={series.cpuBreakdown} format="percent" />
        <NodeMetricChart title="Load average" apiPath={api} dataKey="load" initialData={series.load} format="decimal" />
      </ChartSection>

      <ChartSection title="Memory">
        <NodeMetricChart title="RAM" apiPath={api} dataKey="memory" initialData={series.memory} format="bytes" />
        <NodeMetricChart title="Swap" apiPath={api} dataKey="swap" initialData={series.swap} format="bytes" />
      </ChartSection>

      <ChartSection title="Disks and network">
        <NodeMetricChart title="Storage used %" apiPath={api} dataKey="storage" initialData={series.storage} format="percent" />
        <NodeMetricChart title="Root disk used %" apiPath={api} dataKey="rootFs" initialData={series.rootFs} format="percent" />
        <HostNicChart apiPath={api} initialData={series.nics} className="lg:col-span-2" />
      </ChartSection>
    </div>
  );
}
