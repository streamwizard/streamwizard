import { relative } from "@/components/backups/backup-format";
import { HelpLabel } from "@/components/backups/hint-popover";
import { Rate } from "@/components/vms/rate";
import { Sparkline } from "@/components/vms/sparkline";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import type { AppRow } from "@/lib/apps-model";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CPU_HINT,
  ERRORS_HINT,
  MEMORY_HINT,
  REQUESTS_HINT,
  RESPONSE_HINT,
  STARTS_HINT,
  appHref,
  errorTone,
  formatCpu,
  formatErrorPct,
  formatMs,
  formatPerSec,
  healthDisplay,
} from "./app-format";

const STALE_HINT = "Telegraf has not reported this app for a while. The numbers are from its last report.";

const TONE = {
  default: "",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
} as const;

const RIGHT = "text-right tabular-nums whitespace-nowrap";

function Starts({ row, quiet }: { row: AppRow; quiet: boolean }) {
  if (row.health === "nodata") return <>—</>;
  if (row.failed === 0) return <>{row.starts}</>;
  return (
    <>
      {row.starts} ·{" "}
      <span className={quiet ? undefined : TONE.danger}>
        {row.failed} failed{row.oomKills > 0 ? `, ${row.oomKills} out of memory` : ""}
      </span>
    </>
  );
}

function columns(quiet: boolean): DataColumn<AppRow>[] {
  return [
    {
      key: "app",
      header: "App",
      mobile: "title",
      cell: (r) => (
        <>
          {r.app}
          {r.service && r.service !== r.app && <span className="block font-mono text-xs font-normal break-all text-muted-foreground">{r.service}</span>}
        </>
      ),
    },
    {
      key: "health",
      header: "Health",
      mobile: "badge",
      cell: (r) => {
        const health = healthDisplay(r);
        return (
          <>
            <StatusIndicator status={quiet ? "muted" : health.indicator} label={health.label} />
            {r.stale && (
              <div>
                <HelpLabel help={STALE_HINT} className={cn("text-xs", !quiet && TONE.warning)}>
                  last seen {relative(r.lastSeen)}
                </HelpLabel>
              </div>
            )}
          </>
        );
      },
    },
    {
      key: "cpu",
      header: <HelpLabel help={CPU_HINT}>CPU</HelpLabel>,
      mobileLabel: "CPU",
      headClassName: "text-right",
      className: RIGHT,
      cell: (r) => (
        <span className="inline-flex items-center justify-end gap-2">
          <span className="hidden @2xl:inline-flex">
            <Sparkline values={r.cpuSpark} label={`CPU of ${r.app}, last hour`} />
          </span>
          <span className="@2xl:w-12">{formatCpu(r.cpuPct)}</span>
        </span>
      ),
    },
    {
      key: "memory",
      header: <HelpLabel help={MEMORY_HINT}>Memory</HelpLabel>,
      mobileLabel: "Memory",
      headClassName: "text-right",
      className: RIGHT,
      cell: (r) => (
        <span className="inline-flex items-center justify-end gap-2">
          <span className="hidden @2xl:inline-flex">
            <Sparkline values={r.memSpark} label={`Memory of ${r.app}, last hour`} color="var(--chart-2)" />
          </span>
          <span className="@2xl:w-16">{r.memBytes == null ? "—" : formatBytes(r.memBytes)}</span>
        </span>
      ),
    },
    {
      key: "network",
      header: "Net in / out",
      mobile: "hidden",
      headClassName: "text-right",
      className: RIGHT,
      cell: (r) =>
        r.netRxBps == null && r.netTxBps == null ? (
          "—"
        ) : (
          <>
            <Rate bps={r.netRxBps} /> / <Rate bps={r.netTxBps} />
          </>
        ),
    },
    {
      key: "starts",
      header: <HelpLabel help={STARTS_HINT}>Starts, 24 h</HelpLabel>,
      mobileLabel: "Starts, 24 h",
      headClassName: "text-right",
      className: RIGHT,
      cell: (r) => <Starts row={r} quiet={quiet} />,
    },
    {
      key: "requests",
      header: <HelpLabel help={REQUESTS_HINT}>Requests</HelpLabel>,
      mobile: "hidden",
      headClassName: "text-right",
      className: RIGHT,
      cell: (r) => formatPerSec(r.requestsPerSec),
    },
    {
      key: "errors",
      header: <HelpLabel help={ERRORS_HINT}>Errors</HelpLabel>,
      mobile: "hidden",
      headClassName: "text-right",
      className: RIGHT,
      cell: (r) => <span className={quiet ? undefined : TONE[errorTone(r.errorPct)]}>{formatErrorPct(r.errorPct)}</span>,
    },
    {
      key: "response",
      header: <HelpLabel help={RESPONSE_HINT}>Response</HelpLabel>,
      mobile: "hidden",
      headClassName: "text-right",
      className: RIGHT,
      cell: (r) => formatMs(r.meanMs),
    },
  ];
}

/**
 * One row per app of one environment. `quiet` is for the other tenants on the
 * server: same numbers, no status colours.
 */
export function AppTable({ rows, quiet = false }: { rows: AppRow[]; quiet?: boolean }) {
  return (
    <DataList
      columns={columns(quiet)}
      rows={rows}
      rowKey={(r) => r.key}
      rowHref={(r) => appHref(r.env, r.app)}
      rowClassName={(r) => (r.health === "nodata" || r.stale ? "text-muted-foreground" : undefined)}
    />
  );
}
