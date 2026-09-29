import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { STREAMWIZARD_VM_TAG, VM_ALERT_RULES } from "@repo/alerting/rules";
import { PageHeader } from "@/components/widgets/page-header";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import { formatWhen, relative } from "@/components/backups/backup-format";
import { getGuestNet } from "@/lib/pve";
import { OtherVms } from "@/components/vms/other-vms";
import { UsageMeter } from "@/components/vms/usage-meter";
import { VmTable } from "@/components/vms/vm-table";
import { formatLoad, formatPct, hostStatusDisplay, pctOf, vmHostHref } from "@/components/vms/vm-format";
import { AutoRefresh } from "@/components/vms/auto-refresh";
import { formatBytes } from "@/lib/format";
import { getVmOverview, guestRef, splitVms, toTableRow, type HostView, type VmOverview } from "@/lib/vms";

export const dynamic = "force-dynamic";

const header = <PageHeader title="VMs" description="Proxmox hosts and guests: state, load, storage and IPs. Live from the metrics Proxmox pushes." />;

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      {header}
      <Card>
        <CardContent className="space-y-2 py-10 text-center text-sm text-muted-foreground">{children}</CardContent>
      </Card>
    </div>
  );
}

function HostCard({ host, guests, running }: { host: HostView; guests: number; running: number }) {
  const { name, metrics: m, storages } = host;
  const s = hostStatusDisplay(host.stale);
  const memPct = pctOf(m?.memUsed, m?.memTotal);
  // PBS storages are the backup datastores, shown on /backups.
  const local = storages.filter((st) => st.type !== "pbs" && st.active && st.total);
  const fullest = local.reduce<{ name: string; pct: number } | null>((top, st) => {
    const p = pctOf(st.used, st.total) ?? 0;
    return !top || p > top.pct ? { name: st.storage, pct: p } : top;
  }, null);

  return (
    <Card className="transition-colors hover:border-foreground/20">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between gap-2">
          <Link href={vmHostHref(name)} className="group inline-flex items-center gap-1 font-medium hover:underline">
            {name}
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <StatusIndicator status={s.indicator} label={s.label} />
        </div>

        {m && (
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">CPU</div>
              <div className="tabular-nums">{formatPct(m.cpuPct)}</div>
              <UsageMeter pct={m.cpuPct} label={`CPU of ${name}`} className="mt-1" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">RAM</div>
              <div className="tabular-nums" title={`${formatBytes(m.memUsed)} of ${formatBytes(m.memTotal)}`}>
                {formatPct(memPct)}
              </div>
              <UsageMeter pct={memPct} label={`RAM of ${name}`} warn={90} crit={97} className="mt-1" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Load</div>
              <div className="tabular-nums" title={`Load average: ${formatLoad(m.load1)} (1 min), ${formatLoad(m.load5)} (5 min), ${formatLoad(m.load15)} (15 min)`}>
                {formatLoad(m.load1)}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">{m.cpus != null ? `${m.cpus} cores` : ""}</div>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {running} of {guests} guests running
          {fullest && (
            <>
              {" "}
              · {local.length} {local.length === 1 ? "storage" : "storages"}, fullest {fullest.name} at {formatPct(fullest.pct)}
            </>
          )}
        </div>

        <div className={host.stale ? "text-xs text-red-600 dark:text-red-400" : "text-xs text-muted-foreground"} title={formatWhen(host.lastSeen)}>
          Last report {relative(host.lastSeen)}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function VmsPage() {
  let overview: VmOverview;
  try {
    overview = await getVmOverview();
  } catch (error) {
    return <Message>{(error as Error).message}</Message>;
  }
  const { hosts, vms } = overview;
  const { ours, others } = splitVms(vms);

  if (hosts.length === 0 && vms.length === 0) {
    return (
      <Message>
        <p className="font-medium text-foreground">No Proxmox hosts yet.</p>
        <p>Point the Proxmox metric server (Datacenter → Metric Server) at the proxmox bucket and they show up here.</p>
      </Message>
    );
  }

  // Not awaited: the table renders now, IPs, agent state and disk stream in.
  const net = getGuestNet(vms.map(guestRef));

  return (
    <div className="space-y-6">
      <AutoRefresh />
      {header}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {hosts.map((host) => {
          const mine = vms.filter((v) => v.guest.nodename === host.name);
          return <HostCard key={host.name} host={host} guests={mine.length} running={mine.filter((v) => v.guest.status === "running" && !v.stale).length} />;
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">StreamWizard VMs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <VmTable rows={ours.map(toTableRow)} ruleCount={VM_ALERT_RULES.length} net={net} emptyText={`No VMs tagged ${STREAMWIZARD_VM_TAG} yet.`} />
        </CardContent>
      </Card>

      <OtherVms rows={others.map(toTableRow)} net={net} />
    </div>
  );
}
