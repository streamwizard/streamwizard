"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Cpu, Database, HardDrive, Lock, MemoryStick, Plug } from "lucide-react";
import type { SupabasePlatformSnapshot } from "@repo/metrics";
import {
  SUPABASE_DB_CONN_CRIT_PCT,
  SUPABASE_DB_CONN_WARN_PCT,
  SUPABASE_DB_CPU_CRIT_PCT,
  SUPABASE_DB_CPU_WARN_PCT,
  SUPABASE_DB_DISK_CRIT_PCT,
  SUPABASE_DB_DISK_WARN_PCT,
  SUPABASE_DEADLOCKS_WARN,
  SUPABASE_SCRAPE_SILENT_MIN,
} from "@repo/alerting/thresholds";
import { Badge, Card, CardContent } from "@repo/ui";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/widgets/stat-card";
import { StatusIndicator, type IndicatorStatus } from "@/components/widgets/status-indicator";
import { useMetricsPoll } from "./chart-kit";

// Tile and banner colours use the same numbers as the alert rules (code
// defaults — a per-rule override on /alerts/rules isn't reflected here).
// Memory and cache hit have no alert rule, so their bands live here.
const MEMORY_WARN_PCT = 90;
const MEMORY_CRIT_PCT = 95;
const CACHE_HIT_WARN_PCT = 99;
const CACHE_HIT_CRIT_PCT = 95;
/** Telegraf scrapes every minute; a few missed scrapes means the numbers on
 * this page are stale before the scrape_silent alert would fire. */
const SCRAPE_STALE_MIN = 5;

interface Check {
  id: string;
  label: string;
  icon: LucideIcon;
  value: string;
  status: IndicatorStatus;
  /** Threshold in words, always shown so colour is never the only signal. */
  hint: string;
  /** Short text for the banner when the check fails, e.g. "CPU 91% > 80%". */
  problem: string;
}

type Band = { warn: number; crit: number; direction: "above" | "below" };

function band(value: number | null, b: Band): IndicatorStatus {
  if (value === null) return "muted";
  const over = (limit: number) => (b.direction === "above" ? value > limit : value < limit);
  if (over(b.crit)) return "crit";
  if (over(b.warn)) return "warn";
  return "ok";
}

const pct = (v: number | null, digits = 1) => (v === null ? "—" : `${v.toFixed(digits)}%`);

function buildChecks(s: SupabasePlatformSnapshot | null): Check[] {
  const cpu = s?.cpuPct ?? null;
  const memory = s?.memoryPct ?? null;
  const disk = s?.diskPct ?? null;
  const cacheHit = s?.cacheHitPct ?? null;
  const deadlocks = s?.deadlocks24h ?? null;
  const connections = s?.connections ?? null;
  const maxConnections = s?.maxConnections ?? null;
  const connPct = connections !== null && maxConnections ? (100 * connections) / maxConnections : null;

  return [
    {
      id: "cpu",
      label: "DB CPU",
      icon: Cpu,
      value: pct(cpu),
      status: band(cpu, { warn: SUPABASE_DB_CPU_WARN_PCT, crit: SUPABASE_DB_CPU_CRIT_PCT, direction: "above" }),
      hint: `warn > ${SUPABASE_DB_CPU_WARN_PCT}%`,
      problem: `CPU ${pct(cpu, 0)} > ${SUPABASE_DB_CPU_WARN_PCT}%`,
    },
    {
      id: "memory",
      label: "Memory",
      icon: MemoryStick,
      value: pct(memory),
      status: band(memory, { warn: MEMORY_WARN_PCT, crit: MEMORY_CRIT_PCT, direction: "above" }),
      hint: `warn > ${MEMORY_WARN_PCT}%`,
      problem: `Memory ${pct(memory, 0)} > ${MEMORY_WARN_PCT}%`,
    },
    {
      id: "disk",
      label: "Disk (/data)",
      icon: HardDrive,
      value: pct(disk),
      status: band(disk, { warn: SUPABASE_DB_DISK_WARN_PCT, crit: SUPABASE_DB_DISK_CRIT_PCT, direction: "above" }),
      hint: `warn > ${SUPABASE_DB_DISK_WARN_PCT}%`,
      problem: `Disk ${pct(disk, 0)} > ${SUPABASE_DB_DISK_WARN_PCT}%`,
    },
    {
      id: "connections",
      label: "Connections",
      icon: Plug,
      value:
        connections === null ? "—" : `${Math.round(connections)}${maxConnections ? ` / ${maxConnections}` : ""}`,
      status: band(connPct, { warn: SUPABASE_DB_CONN_WARN_PCT, crit: SUPABASE_DB_CONN_CRIT_PCT, direction: "above" }),
      hint: `warn > ${SUPABASE_DB_CONN_WARN_PCT}% of max`,
      problem: `Connections at ${pct(connPct, 0)} of max`,
    },
    {
      id: "cacheHit",
      label: "Cache hit",
      icon: Database,
      value: pct(cacheHit, 2),
      status: band(cacheHit, { warn: CACHE_HIT_WARN_PCT, crit: CACHE_HIT_CRIT_PCT, direction: "below" }),
      hint: `warn < ${CACHE_HIT_WARN_PCT}%`,
      problem: `Cache hit ${pct(cacheHit, 1)} < ${CACHE_HIT_WARN_PCT}%`,
    },
    {
      id: "deadlocks",
      label: "Deadlocks (24h)",
      icon: Lock,
      value: deadlocks === null ? "—" : Math.round(deadlocks).toLocaleString(),
      status: band(deadlocks, { warn: SUPABASE_DEADLOCKS_WARN, crit: Infinity, direction: "above" }),
      hint: "should stay 0",
      problem: `${Math.round(deadlocks ?? 0)} deadlock${deadlocks === 1 ? "" : "s"} in 24h`,
    },
  ];
}

const SEVERITY: Record<IndicatorStatus, number> = { muted: 0, ok: 1, warn: 2, crit: 3 };

const TILE_TONE = { ok: "default", muted: "default", warn: "warning", crit: "danger" } as const;

const BANNER_BORDER: Record<IndicatorStatus, string> = {
  ok: "border-emerald-500/40",
  warn: "border-amber-500/50",
  crit: "border-red-500/60",
  muted: "",
};

/** Minutes since the last scrape, ticking every 30 s. null until mounted so
 * server and client render the same markup. */
function useScrapeAge(lastScrape: string | null | undefined): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (now === null || !lastScrape) return null;
  return Math.max(0, Math.floor((now - new Date(lastScrape).getTime()) / 60_000));
}

function useSnapshot(initial: SupabasePlatformSnapshot | null): SupabasePlatformSnapshot | null {
  const { snapshot } = useMetricsPoll<{ snapshot: SupabasePlatformSnapshot | null }>("/api/metrics/supabase", {
    snapshot: initial,
  });
  return snapshot ?? initial;
}

/** One-line answer to "is the database OK?": the worst check wins, failing
 * checks are named, and stale data never reads as healthy. */
export function SupabaseHealthBanner({ initialSnapshot }: { initialSnapshot: SupabasePlatformSnapshot | null }) {
  const snapshot = useSnapshot(initialSnapshot);
  const ageMin = useScrapeAge(snapshot?.lastScrape);
  const checks = buildChecks(snapshot);
  const failing = checks.filter((c) => c.status === "warn" || c.status === "crit");

  const stale = ageMin !== null && ageMin > SCRAPE_STALE_MIN;
  const staleStatus: IndicatorStatus = ageMin !== null && ageMin > SUPABASE_SCRAPE_SILENT_MIN ? "crit" : "warn";
  const worst = checks.reduce<IndicatorStatus>(
    (acc, c) => (SEVERITY[c.status] > SEVERITY[acc] ? c.status : acc),
    "muted",
  );
  const noData = !snapshot?.lastScrape;
  const status: IndicatorStatus = noData
    ? "muted"
    : stale && SEVERITY[staleStatus] > SEVERITY[worst]
      ? staleStatus
      : worst;
  const label = noData
    ? "No data yet"
    : stale && failing.length === 0
      ? "Data stale"
      : status === "crit"
        ? "Critical"
        : status === "warn"
          ? "Degraded"
          : "Healthy";

  const updated = ageMin === null ? null : ageMin < 1 ? "updated just now" : `updated ${ageMin}m ago`;

  return (
    <Card className={cn("border", BANNER_BORDER[status])} role="status" aria-live="polite">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <StatusIndicator status={status} label={label} className="text-lg font-semibold" />
          <p className="text-sm text-muted-foreground">
            {noData
              ? "Telegraf hasn't written any Supabase metrics for this environment yet."
              : failing.length === 0
                ? `All ${checks.length} checks passing${stale ? `, but the last scrape was ${ageMin}m ago` : ""}.`
                : `${failing.length} of ${checks.length} checks need attention${stale ? `, and the last scrape was ${ageMin}m ago` : ""}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {failing.map((c) => (
            <Badge
              key={c.id}
              variant="outline"
              className={cn(
                "gap-1.5 font-normal",
                c.status === "crit" ? "border-red-500/60" : "border-amber-500/50",
              )}
            >
              <c.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {c.problem}
            </Badge>
          ))}
          {updated && <span className="text-xs text-muted-foreground tabular-nums">{updated}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

/** The six headline numbers, coloured by the same bands as the banner. */
export function SupabaseKpiTiles({ initialSnapshot }: { initialSnapshot: SupabasePlatformSnapshot | null }) {
  const snapshot = useSnapshot(initialSnapshot);
  const checks = buildChecks(snapshot);

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {checks.map((c) => (
        <StatCard
          key={c.id}
          title={c.label}
          value={c.value}
          icon={c.icon}
          tone={TILE_TONE[c.status]}
          description={c.status === "warn" || c.status === "crit" ? `${c.hint} · breached` : c.hint}
        />
      ))}
    </div>
  );
}
