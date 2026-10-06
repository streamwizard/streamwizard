import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@repo/ui";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import { relative } from "@/components/backups/backup-format";
import { When } from "@/components/backups/hint-popover";
import { formatBytes } from "@/lib/format";
import type { HostView } from "@/lib/vms";
import { UsageMeter } from "./usage-meter";
import { formatLoad, formatPct, hostStatusDisplay, pctOf, vmHostHref } from "./vm-format";

/** One Proxmox host at the top of /vms: load at a glance, linking to the host's page. */
export function HostCard({ host, guests, running }: { host: HostView; guests: number; running: number }) {
  const { name, metrics: m, storages } = host;
  const s = hostStatusDisplay(host.stale);
  const memPct = pctOf(m?.memUsed, m?.memTotal);
  // PBS storages are the backup datastores, shown on /backups.
  const local = storages.filter((st) => st.type !== "pbs" && st.active && st.total);
  const fullest = local.reduce<{ name: string; pct: number } | null>((top, st) => {
    const p = pctOf(st.used, st.total) ?? 0;
    return !top || p > top.pct ? { name: st.storage, pct: p } : top;
  }, null);

  return (
    <Card className="transition-colors hover:border-foreground/20">
      <CardContent className="space-y-3 px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <Link href={vmHostHref(name)} className="group inline-flex min-w-0 items-center gap-1 font-medium break-words hover:underline">
            {name}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <StatusIndicator status={s.indicator} label={s.label} className="shrink-0" />
        </div>

        {/* Three columns hold down to a 311px card: the longest line is the RAM figure, and it wraps. */}
        {m && (
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">CPU</div>
              <div className="tabular-nums">{formatPct(m.cpuPct)}</div>
              <UsageMeter pct={m.cpuPct} label={`CPU of ${name}`} className="mt-1" />
              {m.cpus != null && <div className="mt-1 text-xs text-muted-foreground tabular-nums">{m.cpus} cores</div>}
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">RAM</div>
              <div className="tabular-nums">{formatPct(memPct)}</div>
              <UsageMeter pct={memPct} label={`RAM of ${name}`} warn={90} crit={97} className="mt-1" />
              <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                {formatBytes(m.memUsed)} of {formatBytes(m.memTotal)}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Load, 1 min</div>
              <div className="tabular-nums">{formatLoad(m.load1)}</div>
              <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                <div>5 min {formatLoad(m.load5)}</div>
                <div>15 min {formatLoad(m.load15)}</div>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {running} of {guests} guests running
          {fullest && (
            <>
              {" "}
              · {local.length} {local.length === 1 ? "storage" : "storages"}, fullest {fullest.name} at {formatPct(fullest.pct)}
            </>
          )}
        </div>

        <div className={host.stale ? "text-xs text-red-600 dark:text-red-400" : "text-xs text-muted-foreground"}>
          Last report <When iso={host.lastSeen} label={relative(host.lastSeen)} />
        </div>
      </CardContent>
    </Card>
  );
}
