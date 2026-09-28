"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, ChevronDown, Clock, HardDrive, Layers, ShieldCheck } from "lucide-react";
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
import { VerificationBadge } from "./backup-dashboard";
import { BANNER_BORDER, STATUS_DISPLAY, epochToIso, formatAge, formatBytes, formatWhen, relative } from "./backup-format";

/** Logical snapshot size over time, oldest left. Plain SVG; a handful of points. */
function SizeSparkline({ snapshots }: { snapshots: PbsSnapshot[] }) {
  const points = snapshots.filter((s) => s.sizeBytes !== null).sort((a, b) => a.time - b.time);
  if (points.length < 2) return <p className="text-sm text-muted-foreground">Needs at least two snapshots.</p>;

  const width = 600;
  const height = 80;
  const sizes = points.map((p) => p.sizeBytes!);
  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  // At least 10 % of the largest size as the vertical range, so a few bytes of
  // difference don't read as a big swing.
  const floor = Math.min(min, max - max * 0.1);
  const span = max - floor || 1;
  const t0 = points[0]!.time;
  const tSpan = points[points.length - 1]!.time - t0 || 1;
  const coords = points.map((p) => [((p.time - t0) / tSpan) * (width - 8) + 4, height - 4 - ((p.sizeBytes! - floor) / span) * (height - 8)] as const);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full text-primary" preserveAspectRatio="none" role="img" aria-label="Snapshot size over time">
        <polyline fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" points={coords.map(([x, y]) => `${x},${y}`).join(" ")} />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} fill="currentColor">
            <title>{`${formatWhen(epochToIso(points[i]!.time))}: ${formatBytes(points[i]!.sizeBytes)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>min {formatBytes(min)}</span>
        <span>max {formatBytes(max)}</span>
      </div>
    </div>
  );
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

      <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", pbsStale && "opacity-70")}>
        <StatCard title="Last backup" value={formatAge(vm.ageSeconds)} description={formatWhen(vm.lastSuccessAt)} icon={Clock} />
        <StatCard title="Snapshots" value={vm.snapshotCount} icon={Layers} />
        <StatCard title="Newest size" value={formatBytes(vm.lastSizeBytes)} description="Logical size, before deduplication" icon={HardDrive} />
        <StatCard
          title="Verification"
          value={vm.verification === "ok" ? "Verified" : vm.verification === "failed" ? "Failed" : vm.verification === "pending" ? "Pending" : "None"}
          tone={vm.verification === "ok" ? "positive" : vm.verification === "failed" ? "danger" : "default"}
          icon={ShieldCheck}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Snapshot size</CardTitle>
        </CardHeader>
        <CardContent>
          <SizeSparkline snapshots={snapshots} />
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
                <TableHead className="text-right">Size</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>Protected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    No snapshots in PBS
                  </TableCell>
                </TableRow>
              ) : (
                snapshots.map((s) => (
                  <TableRow key={s.time}>
                    <TableCell suppressHydrationWarning>
                      {formatWhen(epochToIso(s.time))} <span className="text-xs text-muted-foreground">({relative(epochToIso(s.time))})</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatBytes(s.sizeBytes)}</TableCell>
                    <TableCell>
                      <VerificationBadge state={s.verification ?? "none"} />
                    </TableCell>
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
