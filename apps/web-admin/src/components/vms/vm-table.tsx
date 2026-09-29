"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge, NativeSelect, NativeSelectOption, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import { relative } from "@/components/backups/backup-format";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VmTableRow } from "@/lib/vms";
import { DiskUse, GuestAgent, GuestDisk, GuestIps, type GuestNetPromise } from "./guest-net-cells";
import { Rate } from "./rate";
import { Sparkline } from "./sparkline";
import { UsageMeter } from "./usage-meter";
import { HELD_ON_HOST_HINT, RAM_CACHE_HINT, formatPct, formatUptime, pctOf, vmHostHref, vmHref, vmStatusDisplay } from "./vm-format";

type SortKey = "name" | "host" | "status" | "cpu" | "ram" | "held" | "net" | "uptime";
type StatusFilter = "all" | "running" | "stopped" | "other";

const sortValue: Record<SortKey, (r: VmTableRow) => number | string | null> = {
  name: (r) => r.name.toLowerCase(),
  host: (r) => `${r.host}:${String(r.vmid).padStart(9, "0")}`,
  status: (r) => r.status,
  cpu: (r) => r.cpuPct,
  ram: (r) => pctOf(r.memUsed, r.memMax),
  held: (r) => r.memHost,
  net: (r) => (r.netInBps == null && r.netOutBps == null ? null : (r.netInBps ?? 0) + (r.netOutBps ?? 0)),
  uptime: (r) => r.uptimeS,
};

function compare(a: number | string | null, b: number | string | null): number {
  // Missing values sort last either way.
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
}

function SortHead({
  label,
  column,
  sort,
  onSort,
  className,
  title,
}: {
  label: string;
  column: SortKey;
  sort: { key: SortKey; desc: boolean };
  onSort: (key: SortKey) => void;
  className?: string;
  title?: string;
}) {
  const active = sort.key === column;
  const Icon = active ? (sort.desc ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <TableHead className={className} aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"} title={title}>
      <button type="button" onClick={() => onSort(column)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        <Icon className={cn("h-3 w-3", active ? "opacity-100" : "opacity-40")} aria-hidden="true" />
      </button>
    </TableHead>
  );
}

/** The guest table on /vms and on a host's page: sortable, filterable by host and status. */
export function VmTable({
  rows,
  ruleCount,
  showHost = true,
  showAlerts = true,
  net,
  emptyText = "No guests reported by Proxmox yet.",
}: {
  rows: VmTableRow[];
  /** IPs, agent state and disk use from the PVE API, streamed in after the
   * table renders. Without it those columns show "—". */
  net?: GuestNetPromise;
  /** How many per-VM alert rules exist, for the "2/6 on" badge. */
  ruleCount: number;
  showHost?: boolean;
  /** Off for VMs without the streamwizard tag: they can't have alerts. */
  showAlerts?: boolean;
  emptyText?: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "host", desc: false });
  const [host, setHost] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const hosts = useMemo(() => [...new Set(rows.map((r) => r.host))].sort(), [rows]);
  const shown = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (showHost && host !== "all" && r.host !== host) return false;
      if (status === "running") return r.status === "running";
      if (status === "stopped") return r.status === "stopped";
      if (status === "other") return r.status !== "running" && r.status !== "stopped";
      return true;
    });
    const value = sortValue[sort.key];
    return filtered.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va === null || vb === null) return compare(va, vb);
      return sort.desc ? compare(vb, va) : compare(va, vb);
    });
  }, [rows, host, status, sort, showHost]);

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: ["cpu", "ram", "held", "net", "uptime"].includes(key) }));
  const head = { sort, onSort };
  const columns = 10 + (showHost ? 1 : 0) + (showAlerts ? 1 : 0);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-6">
        {showHost && hosts.length > 1 && (
          <NativeSelect size="sm" value={host} onChange={(e) => setHost(e.target.value)} aria-label="Filter by host">
            <NativeSelectOption value="all">All hosts</NativeSelectOption>
            {hosts.map((h) => (
              <NativeSelectOption key={h} value={h}>
                {h}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        <NativeSelect size="sm" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Filter by status">
          <NativeSelectOption value="all">Any status</NativeSelectOption>
          <NativeSelectOption value="running">Running</NativeSelectOption>
          <NativeSelectOption value="stopped">Stopped</NativeSelectOption>
          <NativeSelectOption value="other">Other</NativeSelectOption>
        </NativeSelect>
        <span className="text-xs text-muted-foreground">
          {shown.length} of {rows.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead label="Status" column="status" {...head} />
              <SortHead label="VM" column="name" {...head} />
              {showHost && <SortHead label="Host" column="host" {...head} />}
              <SortHead label="CPU" column="cpu" {...head} className="text-right" />
              <SortHead label="RAM (incl. cache)" column="ram" {...head} className="text-right" title={RAM_CACHE_HINT} />
              <SortHead label="Held on host" column="held" {...head} className="text-right" title={HELD_ON_HOST_HINT} />
              <TableHead className="text-right">Disk</TableHead>
              <SortHead label="Net in / out" column="net" {...head} className="text-right" />
              <SortHead label="Uptime" column="uptime" {...head} />
              <TableHead>IPs</TableHead>
              <TableHead>Agent</TableHead>
              {showAlerts && <TableHead>Alerts</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns} className="py-8 text-center text-muted-foreground">
                  {rows.length === 0 ? emptyText : "No guests match these filters."}
                </TableCell>
              </TableRow>
            ) : (
              shown.map((r) => {
                const s = vmStatusDisplay(r.status);
                const memPct = pctOf(r.memUsed, r.memMax);
                return (
                  <TableRow key={r.key} className={cn(r.stale && "opacity-60")}>
                    <TableCell>
                      <StatusIndicator status={s.indicator} label={s.label} />
                      {r.stale && (
                        <div className="text-xs text-amber-600 dark:text-amber-400" title="Proxmox stopped reporting this guest; status and numbers may be old.">
                          last seen {relative(r.lastSeen)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={vmHref(r.host, r.vmid)} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                      <div className="font-mono text-xs text-muted-foreground">
                        {r.type}/{r.vmid}
                      </div>
                    </TableCell>
                    {showHost && (
                      <TableCell>
                        <Link href={vmHostHref(r.host)} className="hover:underline">
                          {r.host}
                        </Link>
                      </TableCell>
                    )}
                    <TableCell className="text-right tabular-nums">
                      <div className="flex items-center justify-end gap-2">
                        <Sparkline values={r.cpuSpark} max={100} label={`CPU of ${r.name}, last hour`} />
                        <span className="w-10">{r.running ? formatPct(r.cpuPct) : "—"}</span>
                      </div>
                      {r.cpus != null && <div className="text-xs text-muted-foreground">{r.cpus} vCPU</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {r.memUsed != null ? (
                        <>
                          {formatBytes(r.memUsed)} / {formatBytes(r.memMax)}
                          <UsageMeter pct={memPct} label={`RAM of ${r.name}`} warn={90} crit={97} className="mt-1 ml-auto w-24" />
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">{r.memHost != null ? formatBytes(r.memHost) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {r.lxcDiskUsed != null && r.lxcDiskTotal != null ? (
                        <DiskUse used={r.lxcDiskUsed} total={r.lxcDiskTotal} name={r.name} />
                      ) : r.running ? (
                        <GuestDisk net={net} guestKey={r.key} name={r.name} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {r.running && (r.netInBps != null || r.netOutBps != null) ? (
                        <div className="flex items-center justify-end gap-2">
                          <Sparkline values={r.netSpark} label={`Network of ${r.name}, last hour`} color="var(--chart-2)" />
                          <span>
                            <Rate bps={r.netInBps} /> / <Rate bps={r.netOutBps} />
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatUptime(r.uptimeS)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.running ? <GuestIps net={net} guestKey={r.key} /> : "—"}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{r.running ? <GuestAgent net={net} guestKey={r.key} /> : "—"}</TableCell>
                    {showAlerts && (
                      <TableCell>
                        {r.alertRules.length > 0 ? (
                          <Badge variant="secondary" title={r.alertRules.join(", ")}>
                            {r.alertRules.length}/{ruleCount} on
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Off</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
