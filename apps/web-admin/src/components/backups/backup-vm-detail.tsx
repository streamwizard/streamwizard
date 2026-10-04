"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { Archive, ChevronDown, Clock, HardDrive, Layers, Server, ShieldCheck, Upload } from "lucide-react";
import type { BackupVmDetailResponse, PbsSnapshot } from "@repo/backups";
import { Button, Card, CardContent, CardHeader, CardTitle, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@repo/ui";
import { DataList } from "@/components/widgets/data-list";
import { PageHeader } from "@/components/widgets/page-header";
import { StatCard } from "@/components/widgets/stat-card";
import { StatGrid } from "@/components/widgets/stat-grid";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import { vmHref } from "@/components/vms/vm-format";
import type { BackupFetch } from "@/lib/backups";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { cn, fetcher } from "@/lib/utils";
import { VerificationBadge } from "./backup-dashboard";
import { BANNER_BORDER, SIZE_HELP, STATUS_DISPLAY, epochToIso, formatAge, formatApprox, formatBytes, formatWhen, relative } from "./backup-format";
import { HelpLabel } from "./hint-popover";

/**
 * What each kept backup run uploaded, oldest left. Plain SVG bars; a few dozen
 * at most. One run is always picked (the newest to start with) and its date
 * and size are written under the bars, so a value never needs a hover: tap or
 * drag across the bars to pick another.
 */
function UploadBars({ snapshots }: { snapshots: PbsSnapshot[] }) {
  const points = snapshots.filter((s) => s.usage?.uploadedBytes != null).sort((a, b) => a.time - b.time);
  // Keyed by backup time, not index: a poll that adds a run must not move the pick.
  const [pickedTime, setPickedTime] = useState<number | null>(null);
  if (points.length === 0) return <p className="text-sm text-muted-foreground">Shows up after the next poll.</p>;

  const width = 600;
  const height = 80;
  const max = Math.max(...points.map((p) => p.usage!.uploadedBytes!)) || 1;
  const slot = width / points.length;
  const bar = Math.max(2, Math.min(24, slot * 0.7));
  const picked = points.find((p) => p.time === pickedTime) ?? points[points.length - 1]!;

  const pickAt = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    const index = Math.min(points.length - 1, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * points.length)));
    setPickedTime(points[index]!.time);
  };

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        // pan-y: a sideways drag picks a run, an up/down drag still scrolls the page.
        className="h-20 w-full cursor-pointer touch-pan-y text-primary"
        preserveAspectRatio="none"
        role="img"
        aria-label="Uploaded per backup run. The Snapshots list below has the same numbers."
        onPointerDown={pickAt}
        onPointerMove={pickAt}
      >
        {points.map((p, i) => {
          const h = Math.max(1, (p.usage!.uploadedBytes! / max) * (height - 4));
          return (
            <rect
              key={p.time}
              x={i * slot + (slot - bar) / 2}
              y={height - h}
              width={bar}
              height={h}
              rx={1}
              fill="currentColor"
              opacity={p.time === picked.time ? 1 : 0.45}
            />
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="text-sm text-foreground tabular-nums" suppressHydrationWarning>
          {formatWhen(epochToIso(picked.time))}: <span className="font-medium">{formatBytes(picked.usage!.uploadedBytes)}</span>
        </span>
        <span suppressHydrationWarning>
          {points.length} {points.length === 1 ? "run" : "runs"} since {formatWhen(epochToIso(points[0]!.time))} · max {formatBytes(max)}
        </span>
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

  if (!current.data) {
    return (
      <div className="space-y-6">
        <PageHeader title={`VM ${vmid}`} />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{current.error}</CardContent>
        </Card>
      </div>
    );
  }

  return <BackupVmDetailBody detail={current.data} />;
}

/** The page itself, from data already in hand. No fetching of its own. */
export function BackupVmDetailBody({ detail }: { detail: BackupVmDetailResponse }) {
  const { vm, snapshots, events, pbsStale } = detail;
  const display = STATUS_DISPLAY[vm.status];

  return (
    <div className="space-y-6">
      <PageHeader title={vm.name ?? `VM ${vm.vmid}`} description={`${vm.type}/${vm.vmid}${vm.host ? ` on ${vm.host}` : ""}`}>
        {/* The VM page is keyed by host, so the link only exists once the host is known. */}
        {vm.host && (
          <Button asChild variant="outline" size="sm" className="h-11 md:h-8">
            <Link href={vmHref(vm.host, vm.vmid)}>
              <Server aria-hidden />
              VM metrics
            </Link>
          </Button>
        )}
      </PageHeader>

      <Card className={cn("border-l-4", BANNER_BORDER[vm.status])}>
        <CardContent className="px-4 py-4 sm:px-6">
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

      <StatGrid cols={3} className={cn(pbsStale && "opacity-70")}>
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
      </StatGrid>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base">Uploaded per run</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <UploadBars snapshots={snapshots} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base">Snapshots</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {snapshots.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No snapshots in PBS</p>
          ) : (
            <DataList
              rows={snapshots}
              rowKey={(s) => String(s.time)}
              columns={[
                {
                  key: "time",
                  header: "Time",
                  mobile: "title",
                  cell: (s) => (
                    <span suppressHydrationWarning>
                      {formatWhen(epochToIso(s.time))} <span className="text-xs font-normal text-muted-foreground">({relative(epochToIso(s.time))})</span>
                    </span>
                  ),
                },
                {
                  key: "uploaded",
                  header: <HelpLabel help={SIZE_HELP.uploaded}>Uploaded</HelpLabel>,
                  headClassName: "text-right",
                  className: "text-right tabular-nums",
                  cell: (s) =>
                    s.unfinished ? <span className="text-muted-foreground">Backup still running</span> : <span className="tabular-nums">{formatBytes(s.usage?.uploadedBytes)}</span>,
                },
                {
                  key: "onlyHere",
                  header: <HelpLabel help={SIZE_HELP.onlyHere}>Only in this snapshot</HelpLabel>,
                  headClassName: "text-right",
                  className: "text-right tabular-nums",
                  cell: (s) => (s.unfinished ? "—" : <span className="tabular-nums">{formatBytes(s.usage?.exclusiveBytes)}</span>),
                },
                {
                  key: "verification",
                  header: "Verification",
                  mobile: "badge",
                  cell: (s) => (s.unfinished ? <span className="text-muted-foreground">—</span> : <VerificationBadge state={s.verification ?? "none"} />),
                },
                { key: "protected", header: "Protected", cell: (s) => (s.protected ? "Yes" : "No") },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base">Webhook events</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {events.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No webhook events for this VM yet</p>
          ) : (
            <ol className="space-y-3">
              {events.map((e) => {
                const guest = e.guests?.find((g) => g.vmid === vm.vmid);
                return (
                  <li key={e.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <StatusIndicator
                        status={guest?.status === "failed" ? "crit" : guest?.status === "ok" ? "ok" : "muted"}
                        label={`${guest?.status === "failed" ? "Failed" : guest?.status === "ok" ? "OK" : "No result for this VM"} · ${e.source}${e.jobId ? ` · ${e.jobId}` : ""}`}
                        className="min-w-0 items-start font-medium break-words [&>span]:mt-1.5"
                      />
                      <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                        {formatWhen(e.occurredAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm break-words text-muted-foreground">{e.title}</p>
                    <Collapsible>
                      <CollapsibleTrigger className="group mt-1 inline-flex min-h-10 items-center gap-1 text-xs text-muted-foreground hover:text-foreground md:mt-2 md:min-h-0">
                        <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" aria-hidden /> Full message
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 font-mono text-xs break-words">{e.message}</pre>
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
