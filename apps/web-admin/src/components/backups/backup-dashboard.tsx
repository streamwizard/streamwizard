"use client";

import Link from "next/link";
import { useTransition } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Clock, DatabaseBackup, HardDrive, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import type { BackupJobView, BackupOverviewResponse, BackupStatus } from "@repo/backups";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { refreshBackups } from "@/actions/backups";
import { PageHeader } from "@/components/widgets/page-header";
import { StatCard } from "@/components/widgets/stat-card";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import type { BackupFetch } from "@/lib/backups";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { cn, fetcher } from "@/lib/utils";
import { BANNER_BORDER, STATUS_DISPLAY, formatAge, formatBytes, formatWhen, relative } from "./backup-format";

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
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing || !current.data}>
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

  const o = current.data;
  const problems = o.checks.filter((c) => c.status !== "ok");
  const withBackups = o.vms.filter((v) => v.ageSeconds !== null);
  const oldest = withBackups.length ? Math.max(...withBackups.map((v) => v.ageSeconds!)) : null;
  const okCount = o.vms.filter((v) => v.status === "ok").length;

  return (
    <div className="space-y-6">
      {header}

      <Card className={cn("border-l-4", BANNER_BORDER[o.status])}>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusIndicator
              status={STATUS_DISPLAY[o.status].indicator}
              label={o.status === "ok" ? "All backups healthy" : `${problems.length} ${problems.length === 1 ? "check needs" : "checks need"} attention`}
              className="text-base font-medium"
            />
            <span className="text-xs text-muted-foreground" suppressHydrationWarning>
              PBS polled {relative(o.pbs.health.okAt)}
            </span>
          </div>
          {problems.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {problems.map((c) => (
                <li key={c.id} className="flex gap-2">
                  <StatusIndicator status={STATUS_DISPLAY[c.status].indicator} label={c.label} className="shrink-0 font-medium" />
                  <span className="text-muted-foreground">{c.hint}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="VMs OK"
          value={`${okCount}/${o.vms.length}`}
          tone={STATUS_DISPLAY[o.checks.find((c) => c.id === "vms")?.status ?? "unknown"].tone}
          icon={DatabaseBackup}
        />
        <StatCard title="Oldest last backup" value={formatAge(oldest)} description="Across all VMs" icon={Clock} />
        <StatCard
          title="Datastore used"
          value={o.usage ? `${o.usage.usedPct.toFixed(0)} %` : "—"}
          description={o.usage ? `${formatBytes(o.usage.availBytes)} free of ${formatBytes(o.usage.totalBytes)}` : undefined}
          tone={STATUS_DISPLAY[o.checks.find((c) => c.id === "datastore-usage")?.status ?? "unknown"].tone}
          icon={HardDrive}
        />
        {jobTile("Garbage collection", Trash2, o.jobs.gc ? [o.jobs.gc] : [])}
        {jobTile("Prune", Trash2, o.jobs.prune)}
        {jobTile("Re-verify", ShieldCheck, o.jobs.verify)}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Virtual machines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>VM</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Last backup</TableHead>
                  <TableHead className="text-right">Snapshots</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Last webhook</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.vms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No VMs found yet. They appear after the first successful poll.
                    </TableCell>
                  </TableRow>
                ) : (
                  o.vms.map((vm) => (
                    <TableRow key={vm.vmid}>
                      <TableCell className="align-top">
                        <StatusIndicator status={STATUS_DISPLAY[vm.status].indicator} label={STATUS_DISPLAY[vm.status].label} />
                        {vm.reasons.length > 0 && (
                          <ul className="mt-0.5 max-w-xs text-xs text-muted-foreground">
                            {vm.reasons.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Link href={`/backups/${vm.vmid}`} className="font-medium hover:underline">
                          {vm.name ?? `VM ${vm.vmid}`}
                        </Link>
                        <div className="font-mono text-xs text-muted-foreground">
                          {vm.type}/{vm.vmid}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">{vm.host ?? "—"}</TableCell>
                      <TableCell className="align-top" title={formatWhen(vm.lastSuccessAt)} suppressHydrationWarning>
                        {vm.lastSuccessAt ? relative(vm.lastSuccessAt) : "never"}
                      </TableCell>
                      <TableCell className="text-right align-top tabular-nums">{vm.snapshotCount}</TableCell>
                      <TableCell className="text-right align-top tabular-nums">{formatBytes(vm.lastSizeBytes)}</TableCell>
                      <TableCell className="align-top">
                        <VerificationBadge state={vm.verification} />
                      </TableCell>
                      <TableCell className="align-top text-sm" suppressHydrationWarning>
                        {vm.lastEvent ? (
                          <span className={cn(vm.lastEvent.status === "failed" && "text-red-600 dark:text-red-400")}>
                            {vm.lastEvent.status === "ok" ? "OK" : "Failed"} · {relative(vm.lastEvent.at)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {charts}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proxmox hosts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Host</TableHead>
                  <TableHead>Backup jobs</TableHead>
                  <TableHead>Last webhook</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.hosts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                      No PVE hosts configured
                    </TableCell>
                  </TableRow>
                ) : (
                  o.hosts.map((host) => (
                    <TableRow key={host.name}>
                      <TableCell className="align-top">
                        <StatusIndicator status={STATUS_DISPLAY[host.status].indicator} label={host.name} className="font-medium" />
                        {host.reasons.length > 0 && <div className="mt-0.5 text-xs text-muted-foreground">{host.reasons.join("; ")}</div>}
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        {host.jobs.length === 0
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
                            ))}
                      </TableCell>
                      <TableCell className="align-top text-sm" title={formatWhen(host.lastEventAt)} suppressHydrationWarning>
                        {relative(host.lastEventAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent webhooks</CardTitle>
          </CardHeader>
          <CardContent>
            {o.recentEvents.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No webhooks received in the last 8 days</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {o.recentEvents.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3">
                    <StatusIndicator
                      status={e.severity === "error" ? "crit" : e.severity === "warning" ? "warn" : "ok"}
                      label={`${e.source} · ${e.eventType}${e.jobId ? ` · ${e.jobId}` : ""}`}
                    />
                    <span className="shrink-0 text-xs text-muted-foreground" title={formatWhen(e.occurredAt)} suppressHydrationWarning>
                      {relative(e.occurredAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
