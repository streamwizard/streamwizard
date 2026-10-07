import { appHref, errorTone, formatErrorPct, formatMs } from "@/components/apps/app-format";
import { HelpLabel } from "@/components/backups/hint-popover";
import { Rate } from "@/components/vms/rate";
import { Sparkline } from "@/components/vms/sparkline";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import { ENV_LABEL } from "@/lib/apps-model";
import type { TraefikRow } from "@/lib/traefik-model";
import { CLIENT_ERRORS_HINT, DATA_HINT, REQUESTS_HINT, RESPONSE_HINT, SERVER_ERRORS_HINT, SLOW_HINT, formatRequestRate } from "./traefik-format";

const TONE = {
  default: "",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
} as const;

const RIGHT = "text-right tabular-nums whitespace-nowrap";

/** The rest of the server is somebody else's: same numbers, no status colours. */
const toneOf = (row: TraefikRow, pct: number | null) => (row.env === "other" ? "" : TONE[errorTone(pct)]);

function columns(showEnv: boolean): DataColumn<TraefikRow>[] {
  return [
    {
      key: "app",
      header: "App",
      mobile: "title",
      cell: (r) => (
        <>
          {r.app}
          {showEnv && <span className="block text-xs font-normal text-muted-foreground">{ENV_LABEL[r.env]}</span>}
        </>
      ),
    },
    {
      key: "serverErrors",
      header: <HelpLabel help={SERVER_ERRORS_HINT}>5xx</HelpLabel>,
      mobileLabel: "5xx",
      headClassName: "text-right",
      className: RIGHT,
      cell: (r) => <span className={toneOf(r, r.serverErrorPct)}>{formatErrorPct(r.serverErrorPct)}</span>,
    },
    {
      key: "slow",
      header: <HelpLabel help={SLOW_HINT}>Slow</HelpLabel>,
      mobileLabel: "Slow",
      headClassName: "text-right",
      className: RIGHT,
      cell: (r) => <span className={toneOf(r, r.slowPct)}>{formatErrorPct(r.slowPct)}</span>,
    },
    {
      key: "clientErrors",
      header: <HelpLabel help={CLIENT_ERRORS_HINT}>4xx</HelpLabel>,
      mobileLabel: "4xx",
      headClassName: "text-right",
      className: RIGHT,
      cell: (r) => formatErrorPct(r.clientErrorPct),
    },
    {
      key: "requests",
      header: <HelpLabel help={REQUESTS_HINT}>Requests</HelpLabel>,
      mobileLabel: "Requests",
      headClassName: "text-right",
      className: RIGHT,
      cell: (r) => (
        <span className="inline-flex items-center justify-end gap-2">
          <span className="hidden @2xl:inline-flex">
            <Sparkline values={r.sparkline} label={`Requests to ${r.app}, last hour`} />
          </span>
          <span className="@2xl:w-16">{formatRequestRate(r.requestsPerSec)}</span>
        </span>
      ),
    },
    {
      key: "response",
      header: <HelpLabel help={RESPONSE_HINT}>Response</HelpLabel>,
      mobile: "hidden",
      headClassName: "text-right",
      className: RIGHT,
      cell: (r) => formatMs(r.meanMs),
    },
    {
      key: "data",
      header: <HelpLabel help={DATA_HINT}>Data out</HelpLabel>,
      mobile: "hidden",
      headClassName: "text-right",
      className: RIGHT,
      cell: (r) => <Rate bps={r.bytesOutPerSec} />,
    },
  ];
}

/** One row per app Traefik routes to, the one with trouble on top. Each row opens the app's own page. */
export function TraefikAppTable({ rows, showEnv = false }: { rows: TraefikRow[]; showEnv?: boolean }) {
  if (rows.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground">Traefik has no route to an app here. Pick another environment above.</p>;
  }
  return (
    <DataList
      columns={columns(showEnv)}
      rows={rows}
      rowKey={(r) => r.key}
      rowHref={(r) => appHref(r.env, r.app)}
      rowClassName={(r) => (r.requestsPerSec === 0 ? "text-muted-foreground" : undefined)}
    />
  );
}
