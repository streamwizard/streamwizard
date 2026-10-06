"use client";

import Link from "next/link";
import { useTransition } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Archive, Clock, DatabaseBackup, HardDrive, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import type { BackupJobView, BackupOverviewResponse, BackupStatus } from "@repo/backups";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { refreshBackups } from "@/actions/backups";
import { DataList } from "@/components/widgets/data-list";
import { PageHeader } from "@/components/widgets/page-header";
import { StatCard } from "@/components/widgets/stat-card";
import { ChartGrid, StatGrid } from "@/components/widgets/stat-grid";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import type { BackupFetch } from "@/lib/backups";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { cn, fetcher } from "@/lib/utils";
import { BANNER_BORDER, SIZE_HELP, STATUS_DISPLAY, formatAge, formatApprox, formatBytes, relative } from "./backup-format";
import { HelpLabel, When } from "./hint-popover";

const VERIFICATION_LABEL = { ok: "Verified", failed: "Failed", pending: "Pending", none: "Not verified" } as const;

export function VerificationBadge({ state }: { state: keyof typeof VERIFICATION_LABEL }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        state === "ok" && "text-emerald-700 dark:text-emerald-400",
        state === "failed" && "text-red-700 dark:text-red-400",
        (state === "pending" || state === "none") && "text-muted-foreground",
      )}
    >
      {VERIFICATION_LABEL[state]}
    </Badge>
  );
}

function jobTile(title: string, icon: typeof Clock, jobs: BackupJobView[]) {
  if (jobs.length === 0) return <StatCard title={title} value="—" description="No job found" icon={icon} />;
  const worst = jobs.reduce((a, b) => (rank(b.status) > rank(a.status) ? b : a));
  return (
    <StatCard
      title={title}
      value={relative(worst.lastRunAt)}
      description={worst.state === "error" ? (worst.stateText ?? "Failed") : worst.nextRunAt ? `Next run ${relative(worst.nextRunAt)}` : (worst.stateText ?? "")}
      tone={STATUS_DISPLAY[worst.status].tone}
      icon={icon}
    />
  );
}

const rank = (s: BackupStatus) => ({ ok: 0, unknown: 1, warning: 2, error: 3 })[s];

function Reasons({ reasons, className }: { reasons: string[]; className?: string }) {
  return (
    <ul className={cn("text-xs text-muted-foreground", className)}>
      {reasons.map((r) => (
        <li key={r}>{r}</li>
      ))}
    </ul>
  );
}

export function BackupDashboard({
  initial,
  charts,
}: {
  initial: BackupFetch<BackupOverviewResponse>;
  /** Influx charts, rendered server-side by the page below the VM table. */
  charts?: React.ReactNode;
}) {
  const { interval } = useRefreshInterval();
  const { data: result, mutate } = useSWR<BackupFetch<BackupOverviewResponse>>("/api/backups", fetcher, {
    fallbackData: initial,
    refreshInterval: interval,
  });
  const [refreshing, startRefresh] = useTransition();

  const onRefresh = () =>
    startRefresh(async () => {
      const fresh = await refreshBackups();
      if (fresh.error) toast.error(fresh.error);
      else void mutate(fresh, { revalidate: false });
    });

  const current = result ?? initial;
  const header = (
    <PageHeader title="Backups" description={current.data ? `Proxmox backups in ${current.data.datastore} / ${current.data.namespace}` : "Proxmox backups"}>
      <Button variant="outline" size="sm" className="h-11 md:h-8" onClick={onRefresh} disabled={refreshing || !current.data}>
        <RefreshCw className={cn("mr-1.5 h-4 w-4", refreshing && "animate-spin")} aria-hidden />
        Poll now
      </Button>
    </PageHeader>
  );

  if (!current.data) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{current.error}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <BackupOverviewBody overview={current.data} charts={charts} />
    </div>
  );
}

/** Everything under the page header: banner, tiles, VM list, charts, hosts and webhooks. No fetching of its own. */
export function BackupOverviewBody({ overview: o, charts }: { overview: BackupOverviewResponse; charts?: React.ReactNode }) {
  const problems = o.checks.filter((c) => c.status !== "ok");
  const withBackups = o.vms.filter((v) => v.ageSeconds !== null);
  const oldest = withBackups.length ? Math.max(...withBackups.map((v) => v.ageSeconds!)) : null;
  const okCount = o.vms.filter((v) => v.status === "ok").length;

  return (
    <>
      <Card className={cn("border-l-4", BANNER_BORDER[o.status])}>
        <CardContent className="px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusIndicator
              status={STATUS_DISPLAY[o.status].indicator}
              label={o.status === "ok" ? "All backups healthy" : `${problems.length} ${problems.length === 1 ? "check needs" : "checks need"} attention`}
              className="text-base font-medium"
            />
            <span className="text-xs text-muted-foreground">
              PBS polled <When iso={o.pbs.health.okAt} />
            </span>
          </div>
          {problems.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {problems.map((c) => (
                // The hint drops under the label on a phone instead of squeezing beside it.
                <li key={c.id} className="flex flex-col gap-x-2 sm:flex-row">
                  <StatusIndicator status={STATUS_DISPLAY[c.status].indicator} label={c.label} className="shrink-0 font-medium" />
                  <span className="text-muted-foreground">{c.hint}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <StatGrid cols={4}>
        <StatCard
          title="VMs OK"
          value={`${okCount}/${o.vms.length}`}
          tone={STATUS_DISPLAY[o.checks.find((c) => c.id === "vms")?.status ?? "unknown"].tone}
          icon={DatabaseBackup}
        />
        <StatCard title="Oldest last backup" value={formatAge(oldest)} description="Across all VMs" icon={Clock} />
        <StatCard
          title="NAS disk used"
          value={o.usage ? `${o.usage.usedPct.toFixed(0)} %` : "—"}
          description={o.usage ? `${formatBytes(o.usage.availBytes)} free of ${formatBytes(o.usage.totalBytes)}, whole NAS` : undefined}
          tone={STATUS_DISPLAY[o.checks.find((c) => c.id === "datastore-usage")?.status ?? "unknown"].tone}
          icon={HardDrive}
        />
        <StatCard
          title="Our backups on disk"
          value={formatApprox(o.namespaceUsage?.onDiskEstBytes)}
          description={
            o.namespaceUsage
              ? `${formatBytes(o.namespaceUsage.logicalBytes)} of snapshots, ${o.namespaceUsage.dedupFactor?.toFixed(1) ?? "—"}× dedup`
              : "Worked out after the next poll"
          }
          icon={Archive}
        />
        {jobTile("Garbage collection", Trash2, o.jobs.gc ? [o.jobs.gc] : [])}
        {jobTile("Prune", Trash2, o.jobs.prune)}
        {jobTile("Re-verify", ShieldCheck, o.jobs.verify)}
      </StatGrid>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base">Virtual machines</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {o.vms.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No VMs found yet. They appear after the first successful poll.</p>
          ) : (
            <DataList
              rows={o.vms}
              rowKey={(vm) => String(vm.vmid)}
              columns={[
                {
                  key: "status",
                  header: "Status",
                  mobile: "badge",
                  className: "align-top",
                  cell: (vm) => (
                    <>
                      <StatusIndicator status={STATUS_DISPLAY[vm.status].indicator} label={STATUS_DISPLAY[vm.status].label} />
                      {/* On a phone the reasons sit under the name: the badge slot has no room for them. */}
                      {vm.reasons.length > 0 && <Reasons reasons={vm.reasons} className="mt-0.5 hidden w-max max-w-xs whitespace-normal sm:block" />}
                    </>
                  ),
                },
                {
                  key: "vm",
                  header: "VM",
                  mobile: "title",
                  className: "align-top",
                  cell: (vm) => (
                    <>
                      {/* On a phone the whole card is the link. */}
                      <Link
                        href={`/backups/${vm.vmid}`}
                        className="font-medium break-words after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/50 sm:after:hidden"
                      >
                        {vm.name ?? `VM ${vm.vmid}`}
                      </Link>
                      <div className="font-mono text-xs font-normal text-muted-foreground">
                        {vm.type}/{vm.vmid}
                      </div>
                      {vm.reasons.length > 0 && <Reasons reasons={vm.reasons} className="mt-1 font-normal sm:hidden" />}
                    </>
                  ),
                },
                { key: "host", header: "Host", className: "align-top", cell: (vm) => vm.host ?? "—" },
                {
                  key: "last",
                  header: "Last backup",
                  className: "align-top",
                  cell: (vm) => <When iso={vm.lastSuccessAt} />,
                },
                {
                  key: "snapshots",
                  header: "Snapshots",
                  mobile: "hidden",
                  headClassName: "text-right",
                  className: "text-right align-top tabular-nums",
                  cell: (vm) => vm.snapshotCount,
                },
                {
                  key: "disk",
                  header: <HelpLabel help={SIZE_HELP.disk}>Disk</HelpLabel>,
                  mobile: "hidden",
                  headClassName: "text-right",
                  className: "text-right align-top tabular-nums",
                  cell: (vm) => formatBytes(vm.diskBytes),
                },
                {
                  key: "upload",
                  header: <HelpLabel help={SIZE_HELP.lastUpload}>Last upload</HelpLabel>,
                  mobile: "hidden",
                  headClassName: "text-right",
                  className: "text-right align-top tabular-nums",
                  cell: (vm) => formatBytes(vm.lastUploadedBytes),
                },
                {
                  key: "onDisk",
                  header: <HelpLabel help={SIZE_HELP.onDisk}>On disk</HelpLabel>,
                  headClassName: "text-right",
                  className: "text-right align-top tabular-nums",
                  cell: (vm) => <span className="tabular-nums">{formatApprox(vm.usage?.onDiskEstBytes)}</span>,
                },
                {
                  key: "verification",
                  header: "Verification",
                  className: "align-top",
                  cell: (vm) => <VerificationBadge state={vm.verification} />,
                },
                {
                  key: "webhook",
                  header: "Last webhook",
                  mobile: "hidden",
                  className: "align-top text-sm",
                  cell: (vm) =>
                    vm.lastEvent ? (
                      <span className={cn(vm.lastEvent.status === "failed" && "text-red-600 dark:text-red-400")}>
                        {vm.lastEvent.status === "ok" ? "OK" : "Failed"} · <When iso={vm.lastEvent.at} />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    ),
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      {charts}

      <ChartGrid>
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base">Proxmox hosts</CardTitle>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            {o.hosts.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No PVE hosts configured</p>
            ) : (
              <DataList
                rows={o.hosts}
                rowKey={(host) => host.name}
                columns={[
                  {
                    key: "host",
                    header: "Host",
                    mobile: "title",
                    className: "align-top whitespace-normal",
                    cell: (host) => (
                      <>
                        <StatusIndicator status={STATUS_DISPLAY[host.status].indicator} label={host.name} className="font-medium" />
                        {host.reasons.length > 0 && <div className="mt-0.5 text-xs font-normal text-muted-foreground">{host.reasons.join("; ")}</div>}
                      </>
                    ),
                  },
                  {
                    key: "jobs",
                    header: "Backup jobs",
                    className: "align-top text-sm whitespace-normal",
                    cell: (host) =>
                      host.jobs.length === 0
                        ? "—"
                        : host.jobs.map((j) => (
                            <div key={j.id}>
                              <code className="font-mono text-xs">{j.id}</code>
                              <span className="text-muted-foreground">
                                {" "}
                                · {j.schedule ?? "no schedule"} · {j.selection === "pool" ? "pool" : `${j.vmids.length} VMs`}
                                {!j.enabled && " · disabled"}
                              </span>
                            </div>
                          )),
                  },
                  {
                    key: "webhook",
                    header: "Last webhook",
                    className: "align-top text-sm",
                    cell: (host) => <When iso={host.lastEventAt} />,
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base">Recent webhooks</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {o.recentEvents.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No webhooks received in the last 8 days</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {o.recentEvents.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3">
                    <StatusIndicator
                      status={e.severity === "error" ? "crit" : e.severity === "warning" ? "warn" : "ok"}
                      label={`${e.source} · ${e.eventType}${e.jobId ? ` · ${e.jobId}` : ""}`}
                      className="min-w-0 items-start break-words [&>span]:mt-1.5"
                    />
                    <When iso={e.occurredAt} className="shrink-0 text-xs text-muted-foreground" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </ChartGrid>
    </>
  );
}
