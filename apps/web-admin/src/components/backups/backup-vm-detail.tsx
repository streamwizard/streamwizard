"use client";

import Link from "next/link";
import useSWR from "swr";
import { Archive, ArrowLeft, ChevronDown, Clock, HardDrive, Layers, ShieldCheck, Upload } from "lucide-react";
import type { BackupVmDetailResponse, PbsSnapshot } from "@repo/backups";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import { PageHeader } from "@/components/widgets/page-header";
import { StatCard } from "@/components/widgets/stat-card";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import type { BackupFetch } from "@/lib/backups";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { cn, fetcher } from "@/lib/utils";
import { HelpHead, VerificationBadge } from "./backup-dashboard";
import { BANNER_BORDER, SIZE_HELP, STATUS_DISPLAY, epochToIso, formatAge, formatApprox, formatBytes, formatWhen, relative } from "./backup-format";

/** What each kept backup run uploaded, oldest left. Plain SVG bars; a few dozen at most. */
function UploadBars({ snapshots }: { snapshots: PbsSnapshot[] }) {
  const points = snapshots.filter((s) => s.usage?.uploadedBytes != null).sort((a, b) => a.time - b.time);
  if (points.length === 0) return <p className="text-sm text-muted-foreground">Shows up after the next poll.</p>;

  const width = 600;
  const height = 80;
  const max = Math.max(...points.map((p) => p.usage!.uploadedBytes!)) || 1;
  const slot = width / points.length;
  const bar = Math.max(2, Math.min(24, slot * 0.7));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full text-primary" preserveAspectRatio="none" role="img" aria-label="Uploaded per backup run">
        {points.map((p, i) => {
          const h = Math.max(1, (p.usage!.uploadedBytes! / max) * (height - 4));
          return (
            <rect key={p.time} x={i * slot + (slot - bar) / 2} y={height - h} width={bar} height={h} rx={1} fill="currentColor">
              <title>{`${formatWhen(epochToIso(p.time))}: ${formatBytes(p.usage!.uploadedBytes)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span suppressHydrationWarning>{formatWhen(epochToIso(points[0]!.time))}</span>
        <span>max {formatBytes(max)}</span>
      </div>
    </div>
  );
}

function diskSummary(vm: BackupVmDetailResponse["vm"]): string | undefined {
  if (!vm.disks?.length) return undefined;
  return vm.disks.map((d) => `${d.key} ${formatBytes(d.sizeBytes)}${d.backedUp ? "" : " (skipped)"}`).join(" · ");
}

export function BackupVmDetail({ vmid, initial }: { vmid: number; initial: BackupFetch<BackupVmDetailResponse> }) {
  const { interval } = useRefreshInterval();
  const { data: result } = useSWR<BackupFetch<BackupVmDetailResponse>>(`/api/backups/vms/${vmid}`, fetcher, {
    fallbackData: initial,
    refreshInterval: interval,
  });
  const current = result ?? initial;

  const back = (
    <Link href="/backups" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden /> All backups
    </Link>
  );

  if (!current.data) {
    return (
      <div className="space-y-4">
        {back}
        <PageHeader title={`VM ${vmid}`} />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{current.error}</CardContent>
        </Card>
      </div>
    );
  }

  const { vm, snapshots, events, pbsStale } = current.data;
  const display = STATUS_DISPLAY[vm.status];

  return (
    <div className="space-y-6">
      {back}
      <PageHeader title={vm.name ?? `VM ${vm.vmid}`} description={`${vm.type}/${vm.vmid}${vm.host ? ` on ${vm.host}` : ""}`} />

      <Card className={cn("border-l-4", BANNER_BORDER[vm.status])}>
        <CardContent className="py-4">
          <StatusIndicator status={display.indicator} label={vm.status === "ok" ? "Backups healthy" : display.label} className="text-base font-medium" />
          {vm.reasons.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
              {vm.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          {pbsStale && <p className="mt-2 text-xs text-muted-foreground">PBS data is not current; values show the last successful poll.</p>}
        </CardContent>
      </Card>

      <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", pbsStale && "opacity-70")}>
        <StatCard title="Last backup" value={formatAge(vm.ageSeconds)} description={formatWhen(vm.lastSuccessAt)} icon={Clock} />
        <StatCard title="Snapshots" value={vm.snapshotCount} icon={Layers} />
        <StatCard
          title="Verification"
          value={vm.verification === "ok" ? "Verified" : vm.verification === "failed" ? "Failed" : vm.verification === "pending" ? "Pending" : "None"}
          tone={vm.verification === "ok" ? "positive" : vm.verification === "failed" ? "danger" : "default"}
          icon={ShieldCheck}
        />
        <StatCard title="Disk" value={formatBytes(vm.diskBytes)} description={diskSummary(vm) ?? "Backed-up disks, from the PVE config"} icon={HardDrive} />
        <StatCard title="Last upload" value={formatBytes(vm.lastUploadedBytes)} description="Sent to PBS by the newest run, compressed" icon={Upload} />
        <StatCard
          title="On disk"
          value={formatApprox(vm.usage?.onDiskEstBytes)}
          description={
            vm.usage
              ? `${formatBytes(vm.usage.uniqueBytes)} unique before compression${vm.usage.sharedBytes > 0 ? `, ${formatBytes(vm.usage.sharedBytes)} shared with other VMs` : ""}`
              : "Worked out after the next poll"
          }
          icon={Archive}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uploaded per run</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadBars snapshots={snapshots} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Snapshots</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <HelpHead help={SIZE_HELP.uploaded} className="text-right">
                  Uploaded
                </HelpHead>
                <HelpHead help={SIZE_HELP.onlyHere} className="text-right">
                  Only in this snapshot
                </HelpHead>
                <TableHead>Verification</TableHead>
                <TableHead>Protected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    No snapshots in PBS
                  </TableCell>
                </TableRow>
              ) : (
                snapshots.map((s) => (
                  <TableRow key={s.time}>
                    <TableCell suppressHydrationWarning>
                      {formatWhen(epochToIso(s.time))} <span className="text-xs text-muted-foreground">({relative(epochToIso(s.time))})</span>
                    </TableCell>
                    {s.unfinished ? (
                      <TableCell colSpan={3} className="text-muted-foreground">
                        Backup still running
                      </TableCell>
                    ) : (
                      <>
                        <TableCell className="text-right tabular-nums">{formatBytes(s.usage?.uploadedBytes)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatBytes(s.usage?.exclusiveBytes)}</TableCell>
                        <TableCell>
                          <VerificationBadge state={s.verification ?? "none"} />
                        </TableCell>
                      </>
                    )}
                    <TableCell>{s.protected ? "Yes" : "No"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No webhook events for this VM yet</p>
          ) : (
            <ol className="space-y-3">
              {events.map((e) => {
                const guest = e.guests?.find((g) => g.vmid === vm.vmid);
                return (
                  <li key={e.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusIndicator
                        status={guest?.status === "failed" ? "crit" : guest?.status === "ok" ? "ok" : "muted"}
                        label={`${guest?.status === "failed" ? "Failed" : guest?.status === "ok" ? "OK" : "No result for this VM"} · ${e.source}${e.jobId ? ` · ${e.jobId}` : ""}`}
                        className="font-medium"
                      />
                      <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                        {formatWhen(e.occurredAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{e.title}</p>
                    <Collapsible>
                      <CollapsibleTrigger className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        <ChevronDown className="h-3 w-3" aria-hidden /> Full message
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 font-mono text-xs">{e.message}</pre>
                      </CollapsibleContent>
                    </Collapsible>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
