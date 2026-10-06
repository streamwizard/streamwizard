import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@repo/ui";
import { relative } from "@/components/backups/backup-format";
import { When } from "@/components/backups/hint-popover";
import { Rate } from "@/components/vms/rate";
import { UsageMeter } from "@/components/vms/usage-meter";
import { formatLoad, formatPct, formatUptime, hostStatusDisplay } from "@/components/vms/vm-format";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import type { ServerView } from "@/lib/apps";
import { formatBytes } from "@/lib/format";
import { SERVER_HREF } from "./app-format";

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

const SUB = "mt-1 text-xs text-muted-foreground tabular-nums";

/** The Dokploy server at the top of /apps: load at a glance, linking to its page. */
export function ServerCard({ server }: { server: ServerView }) {
  const { snapshot: s, stale, oomKills24h } = server;
  const status = hostStatusDisplay(stale);
  const name = s.host || "Server";

  return (
    <Card className="transition-colors hover:border-foreground/20">
      <CardContent className="space-y-3 px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <Link href={SERVER_HREF} className="group inline-flex min-w-0 items-center gap-1 font-medium break-words hover:underline">
            {name}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <StatusIndicator status={status.indicator} label={status.label} className="shrink-0" />
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-4 text-sm sm:grid-cols-3 xl:grid-cols-6">
          <Figure label="CPU">
            <div className="tabular-nums">{formatPct(s.cpuPct)}</div>
            <UsageMeter pct={s.cpuPct} label={`CPU of ${name}`} className="mt-1" />
            {s.cpus != null && <div className={SUB}>{s.cpus} cores</div>}
          </Figure>
          <Figure label="Memory">
            <div className="tabular-nums">{formatPct(s.memUsedPct)}</div>
            <UsageMeter pct={s.memUsedPct} label={`Memory of ${name}`} warn={90} crit={97} className="mt-1" />
            <div className={SUB}>
              {formatBytes(s.memUsed)} of {formatBytes(s.memTotal)}
            </div>
          </Figure>
          <Figure label="Disk /">
            <div className="tabular-nums">{formatPct(s.diskUsedPct)}</div>
            <UsageMeter pct={s.diskUsedPct} label={`Disk of ${name}`} warn={80} crit={90} className="mt-1" />
            <div className={SUB}>
              {formatBytes(s.diskUsed)} of {formatBytes(s.diskTotal)}
            </div>
          </Figure>
          <Figure label="Load, 1 min">
            <div className="tabular-nums">{formatLoad(s.load1)}</div>
            <div className={SUB}>
              <div>5 min {formatLoad(s.load5)}</div>
              <div>15 min {formatLoad(s.load15)}</div>
            </div>
          </Figure>
          <Figure label="Network in / out">
            <div className="tabular-nums">
              <Rate bps={s.netRxBps} />
            </div>
            <div className="tabular-nums">
              <Rate bps={s.netTxBps} />
            </div>
          </Figure>
          <Figure label="OOM kills, 24 h">
            <div className={oomKills24h ? "tabular-nums text-red-600 dark:text-red-400" : "tabular-nums"}>{oomKills24h ?? "—"}</div>
            <div className={SUB}>Swap {formatPct(s.swapUsedPct)}</div>
          </Figure>
        </div>

        <div className="text-xs text-muted-foreground">
          {s.containersRunning != null && <>{s.containersRunning} containers running · </>}
          up {formatUptime(s.uptimeSeconds)} ·{" "}
          <span className={stale ? "text-red-600 dark:text-red-400" : undefined}>
            last report <When iso={s.time} label={relative(s.time)} />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
