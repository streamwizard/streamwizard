"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Info } from "lucide-react";
import {
  Badge,
  Button,
  NativeSelect,
  NativeSelectOption,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import { FilterPanel } from "@/components/widgets/filter-panel";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import { relative } from "@/components/backups/backup-format";
import { HelpLabel } from "@/components/backups/hint-popover";
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

// Numbers start at the top: the busiest guest is what you sort for.
const DESC_FIRST: SortKey[] = ["cpu", "ram", "held", "net", "uptime"];

// The phone has no column headers to tap, so the same keys sit in a select.
const SORT_LABEL: Record<SortKey, string> = {
  host: "Host",
  name: "Name",
  status: "Status",
  cpu: "CPU",
  ram: "RAM",
  held: "Held on host",
  net: "Network",
  uptime: "Uptime",
};

const STALE_HINT = "Proxmox stopped reporting this guest; status and numbers may be old.";

// 44px and 16px text on a phone (no iOS zoom on focus); the compact toolbar size from 768px.
const SELECT_CLASS = "h-11 text-base text-foreground md:h-8 md:py-1 md:text-sm";

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
  hint,
}: {
  label: string;
  column: SortKey;
  sort: { key: SortKey; desc: boolean };
  onSort: (key: SortKey) => void;
  className?: string;
  /** Explains the column, behind an info button so it opens on a tap too. */
  hint?: string;
}) {
  const active = sort.key === column;
  const Icon = active ? (sort.desc ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <TableHead className={className} aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}>
      <span className="inline-flex items-center gap-1">
        <button type="button" onClick={() => onSort(column)} className="inline-flex items-center gap-1 hover:text-foreground">
          {label}
          <Icon className={cn("h-3 w-3", active ? "opacity-100" : "opacity-40")} aria-hidden="true" />
        </button>
        {hint && (
          <Popover>
            <PopoverTrigger
              aria-label={`About ${label}`}
              className="-m-1 rounded-full p-1 text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </PopoverTrigger>
            <PopoverContent className="w-64 text-sm font-normal whitespace-normal">{hint}</PopoverContent>
          </Popover>
        )}
      </span>
    </TableHead>
  );
}

/** A select with its label above it on a phone; from 640px the label is for screen readers only. */
function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("flex w-full flex-col gap-1 text-xs text-muted-foreground sm:w-auto [&_[data-slot=native-select-wrapper]]:w-full", className)}>
      <span className="sm:sr-only">{label}</span>
      {children}
    </label>
  );
}

/** "2/6 on", with the rule names behind a tap instead of a hover. */
function AlertsBadge({ rules, ruleCount }: { rules: string[]; ruleCount: number }) {
  if (rules.length === 0) return <span className="text-sm text-muted-foreground">Off</span>;
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`${rules.length} of ${ruleCount} alerts on. Show which.`}
        className="relative z-10 -m-2 rounded-md p-2 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Badge variant="secondary" className="tabular-nums">
          {rules.length}/{ruleCount} on
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-64 text-sm">
        <p className="text-xs text-muted-foreground">Alerts on</p>
        <ul className="mt-1 space-y-0.5 font-mono text-xs">
          {rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function Usage({
  label,
  value,
  pct,
  detail,
  meterLabel,
  warn,
  crit,
}: {
  label: string;
  value: string;
  pct: number | null;
  detail?: string;
  meterLabel: string;
  warn?: number;
  crit?: number;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm tabular-nums">{value}</span>
      </div>
      <UsageMeter pct={pct} label={meterLabel} warn={warn} crit={crit} className="mt-1" />
      {detail && <div className="mt-1 text-xs text-muted-foreground tabular-nums">{detail}</div>}
    </div>
  );
}

/** One guest on a phone: the whole card opens the VM, the alerts badge opens its own popover. */
function VmCard({ row: r, ruleCount, showHost, showAlerts }: { row: VmTableRow; ruleCount: number; showHost: boolean; showAlerts: boolean }) {
  const s = vmStatusDisplay(r.status);
  const memPct = pctOf(r.memUsed, r.memMax);
  return (
    <li className={cn("relative space-y-3 px-4 py-3", r.stale && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={vmHref(r.host, r.vmid)}
            className="text-sm font-medium break-words after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/50"
          >
            {r.name}
          </Link>
          <div className="font-mono text-xs text-muted-foreground">
            {r.type}/{r.vmid}
          </div>
        </div>
        <StatusIndicator status={s.indicator} label={s.label} className="shrink-0" />
      </div>

      {r.stale && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Last seen {relative(r.lastSeen)}. {STALE_HINT}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Usage
          label="CPU"
          value={r.running ? formatPct(r.cpuPct) : "—"}
          pct={r.running ? r.cpuPct : null}
          detail={r.cpus != null ? `${r.cpus} vCPU` : undefined}
          meterLabel={`CPU of ${r.name}`}
        />
        <Usage
          label="RAM"
          value={formatPct(memPct)}
          pct={memPct}
          detail={r.memUsed != null ? `${formatBytes(r.memUsed)} of ${formatBytes(r.memMax)}` : undefined}
          meterLabel={`RAM of ${r.name}`}
          warn={90}
          crit={97}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="min-w-0 break-words">
          {showHost && <>Host {r.host}</>}
          {showHost && r.running && " · "}
          {r.running && <>Up {formatUptime(r.uptimeS)}</>}
        </span>
        {showAlerts && (
          <span className="flex items-center gap-2">
            Alerts
            <AlertsBadge rules={r.alertRules} ruleCount={ruleCount} />
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * The guest list on /vms and on a host's page. From 640px up it is the
 * sortable table; below that a card per guest, with sort and the filters
 * behind the "Filters" button.
 */
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
  const hostFilter = showHost && hosts.length > 1;
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

  const onSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: DESC_FIRST.includes(key) }));
  const head = { sort, onSort };
  const columns = 10 + (showHost ? 1 : 0) + (showAlerts ? 1 : 0);
  const activeFilters = (hostFilter && host !== "all" ? 1 : 0) + (status !== "all" ? 1 : 0);
  const empty = rows.length === 0 ? emptyText : "No guests match these filters.";
  // Without the host column, "host" order is just the VM ID.
  const sortKeys = (Object.keys(SORT_LABEL) as SortKey[]).filter((key) => showHost || key !== "host");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-6">
        <FilterPanel activeCount={activeFilters} className="order-last items-end">
          <div className="flex w-full items-end gap-2 sm:hidden">
            <Field label="Sort by">
              <NativeSelect
                className={SELECT_CLASS}
                value={sort.key}
                onChange={(e) => {
                  const key = e.target.value as SortKey;
                  setSort({ key, desc: DESC_FIRST.includes(key) });
                }}
              >
                {!showHost && <NativeSelectOption value="host">VM ID</NativeSelectOption>}
                {sortKeys.map((key) => (
                  <NativeSelectOption key={key} value={key}>
                    {SORT_LABEL[key]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              className="shrink-0"
              aria-label={sort.desc ? "Highest first. Switch to lowest first." : "Lowest first. Switch to highest first."}
              onClick={() => setSort((s) => ({ ...s, desc: !s.desc }))}
            >
              {sort.desc ? <ArrowDown aria-hidden="true" /> : <ArrowUp aria-hidden="true" />}
            </Button>
          </div>
          {hostFilter && (
            <Field label="Host">
              <NativeSelect className={SELECT_CLASS} value={host} onChange={(e) => setHost(e.target.value)}>
                <NativeSelectOption value="all">All hosts</NativeSelectOption>
                {hosts.map((h) => (
                  <NativeSelectOption key={h} value={h}>
                    {h}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field label="Status">
            <NativeSelect className={SELECT_CLASS} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <NativeSelectOption value="all">Any status</NativeSelectOption>
              <NativeSelectOption value="running">Running</NativeSelectOption>
              <NativeSelectOption value="stopped">Stopped</NativeSelectOption>
              <NativeSelectOption value="other">Other</NativeSelectOption>
            </NativeSelect>
          </Field>
        </FilterPanel>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums sm:ml-0">
          {shown.length} of {rows.length}
        </span>
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead label="Status" column="status" {...head} />
              <SortHead label="VM" column="name" {...head} />
              {showHost && <SortHead label="Host" column="host" {...head} />}
              <SortHead label="CPU" column="cpu" {...head} className="text-right" />
              <SortHead label="RAM (incl. cache)" column="ram" {...head} className="text-right" hint={RAM_CACHE_HINT} />
              <SortHead label="Held on host" column="held" {...head} className="text-right" hint={HELD_ON_HOST_HINT} />
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
                  {empty}
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
                        <div>
                          <HelpLabel help={STALE_HINT} className="text-xs text-amber-600 dark:text-amber-400">
                            last seen {relative(r.lastSeen)}
                          </HelpLabel>
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
                        <AlertsBadge rules={r.alertRules} ruleCount={ruleCount} />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="sm:hidden">
        {shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <>
            <ul className="divide-y">
              {shown.map((r) => (
                <VmCard key={r.key} row={r} ruleCount={ruleCount} showHost={showHost} showAlerts={showAlerts} />
              ))}
            </ul>
            {/* The table explains this behind the column's info button; here it is one line under the list. */}
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">RAM includes cache.</span> {RAM_CACHE_HINT}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
