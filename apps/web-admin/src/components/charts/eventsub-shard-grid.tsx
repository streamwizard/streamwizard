"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, CircleDashed, Grid3x3, LayoutGrid, XCircle } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import type { EventsubShardThroughputPoint } from "@repo/metrics";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui";
import { Sparkline } from "@/components/widgets/sparkline";
import type { IndicatorStatus } from "@/components/widgets/status-indicator";
import { ChartEmptyState } from "@/components/widgets/chart-empty-state";
import { formatElapsed } from "@/lib/format";
import { byWorstFirst, padShardThroughput, TILE_VIEW_MAX_SHARDS, type ShardView } from "@/lib/eventsub-health";
import type { LifecycleRow } from "@/lib/eventsub-metrics";
import { DASHBOARD_COOKIE, writeDashboardCookie } from "@/lib/dashboard-prefs";
import { useHydrated } from "@/lib/use-hydrated";
import { cn, formatTime } from "@/lib/utils";
import { AXIS_TICK, CHART_TOOLTIP_STYLE, ChartBody } from "./chart-kit";

export type ShardGridView = "grid" | "heatmap";

const STATUS_ICON: Record<IndicatorStatus, LucideIcon> = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  crit: XCircle,
  muted: CircleDashed,
};

const STATUS_TEXT: Record<IndicatorStatus, string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  crit: "text-red-600 dark:text-red-400",
  muted: "text-muted-foreground",
};

/** Heatmap cells without a heartbeat: striped, so an outage never reads as a
 * quiet bucket in either theme. */
const GAP_STYLE = {
  backgroundImage:
    "repeating-linear-gradient(135deg, color-mix(in oklab, var(--muted-foreground) 45%, transparent) 0 2px, transparent 2px 5px)",
} as const;

const STATUS_SQUARE: Record<IndicatorStatus, string> = {
  ok: "bg-emerald-500/80 border-emerald-600/40",
  warn: "bg-amber-500/90 border-amber-600/50",
  crit: "bg-red-500/90 border-red-600/60",
  muted: "bg-muted border-border",
};

/** Dot, icon and text: the status never rests on colour alone. */
function ShardStatus({ shard, className }: { shard: ShardView; className?: string }) {
  const Icon = STATUS_ICON[shard.status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", STATUS_TEXT[shard.status], className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {shard.label}
    </span>
  );
}

const age = (ms: number | null | undefined) => (ms === null || ms === undefined ? "—" : formatElapsed(ms));

function ShardTile({ shard, series, onOpen }: { shard: ShardView; series: EventsubShardThroughputPoint[]; onOpen: () => void }) {
  const hb = shard.heartbeat;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        shard.status === "crit" && "border-red-500/60",
        shard.status === "warn" && "border-amber-500/50",
      )}
      aria-label={`Shard ${shard.id}: ${shard.label}. Open details`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-sm font-semibold">#{shard.id}</span>
        <ShardStatus shard={shard} />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Helix</dt>
        <dd className="min-w-0 text-right break-words">{shard.helix ? shard.helix.status.replace(/_/g, " ") : "—"}</dd>
        {shard.stale ? (
          <>
            <dt className="text-muted-foreground">Last heartbeat</dt>
            <dd className="text-right font-medium tabular-nums text-red-600 dark:text-red-400">{age(shard.heartbeatAgeMs)} ago</dd>
          </>
        ) : (
          <>
            <dt className="text-muted-foreground">Bot</dt>
            <dd className="text-right">{shard.botState ?? "—"}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Events / min</dt>
        <dd className="text-right tabular-nums">{shard.eventsPerMin ?? "—"}</dd>
        {/* A stale heartbeat's socket numbers describe the past, not now. */}
        <dt className="text-muted-foreground">Last message</dt>
        <dd className="text-right tabular-nums">{shard.stale ? "—" : age(hb?.lastMessageAgeMs)}</dd>
        <dt className="text-muted-foreground">Session age</dt>
        <dd className="text-right tabular-nums">{!shard.stale && hb?.sessionAgeS != null ? formatElapsed(hb.sessionAgeS * 1000) : "—"}</dd>
        <dt className="text-muted-foreground">Outages (24h)</dt>
        <dd className="text-right tabular-nums">{shard.lost24h}</dd>
      </dl>
      <Sparkline values={series.map((p) => p.count)} label={`Shard ${shard.id} notifications, last 6 hours`} />
    </button>
  );
}

function ShardStrip({ shards, onOpen }: { shards: ShardView[]; onOpen: (id: string) => void }) {
  const problems = shards.filter((s) => s.status === "warn" || s.status === "crit").sort(byWorstFirst);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <ul className="flex flex-wrap gap-1" aria-label={`${shards.length} shards`}>
          {shards.map((s) => {
            const Icon = STATUS_ICON[s.status];
            return (
              <li key={s.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onOpen(s.id)}
                      aria-label={`Shard ${s.id}: ${s.label}`}
                      className={cn(
                        // A tap target on a phone, a dense strip from 768px up.
                        "flex size-11 flex-col items-center justify-center gap-0.5 rounded-sm border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-5",
                        STATUS_SQUARE[s.status],
                        s.status === "muted" ? "text-muted-foreground" : "text-white",
                      )}
                    >
                      {s.status !== "ok" && <Icon className="size-3" aria-hidden="true" />}
                      {/* There is no hover on a phone, so the big square says which shard it is. */}
                      <span className="font-mono text-[11px] leading-none md:hidden" aria-hidden="true">
                        {s.id}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">
                      Shard {s.id}: {s.label}
                    </p>
                    <p className="max-w-64 text-xs opacity-80">{s.detail}</p>
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Squares with an icon need attention. Select a square for details.
        </p>
      </div>
      <div className="min-w-0">
        <h3 className="mb-2 text-sm font-medium">Problem shards</h3>
        {problems.length === 0 ? (
          <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">All {shards.length} shards healthy.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shard</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Outages (24h)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {problems.slice(0, 25).map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => onOpen(s.id)}>
                  <TableCell className="font-mono text-xs">#{s.id}</TableCell>
                  <TableCell className="whitespace-normal">
                    <ShardStatus shard={s} />
                    <p className="text-xs text-muted-foreground">{s.detail}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.lost24h}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {problems.length > 25 && <p className="mt-2 text-xs text-muted-foreground">and {problems.length - 25} more</p>}
      </div>
    </div>
  );
}

/** Shards as rows, 5-minute buckets as columns. Striped cells have no heartbeat
 * at all (down or not running), so outages read as gaps. */
function ShardHeatmap({ shards, byShard, onOpen }: { shards: ShardView[]; byShard: Map<string, EventsubShardThroughputPoint[]>; onOpen: (id: string) => void }) {
  // Times are in the viewer's locale, which the server doesn't know: leave
  // titles and axis labels out until hydrated so both renders match.
  const hydrated = useHydrated();
  const all = [...byShard.values()].flat();
  const times = byShard.values().next().value?.map((p) => p.time) ?? [];
  const max = Math.max(1, ...all.map((p) => p.count ?? 0));
  if (!all.some((p) => p.count !== null)) return <ChartEmptyState height={160} message="No shard heartbeats in the last 6 hours" />;
  const rowHeight = shards.length > 40 ? 5 : shards.length > 16 ? 8 : 14;
  // On a phone the row is the tap target for its shard: a small fleet gets
  // rows a finger can hit, a large one keeps the dense picture.
  const phoneRowHeight = shards.length <= 8 ? 44 : shards.length <= 16 ? 28 : rowHeight;
  const rowClass = "h-(--row-phone) md:h-(--row)";
  const labelEvery = Math.max(1, Math.ceil(times.length / 6));
  const outageCells = all.filter((p) => p.count === null).length;

  return (
    <div>
      <div
        role="img"
        aria-label={`Heatmap of ${shards.length} shards over the last 6 hours; ${outageCells} five-minute buckets without a heartbeat`}
        className="grid gap-px"
        style={
          {
            gridTemplateColumns: `3rem repeat(${times.length}, minmax(0, 1fr))`,
            "--row": `${rowHeight}px`,
            "--row-phone": `${phoneRowHeight}px`,
          } as React.CSSProperties
        }
      >
        {shards.map((s) => {
          const byTime = new Map((byShard.get(s.id) ?? []).map((p) => [p.time, p.count]));
          // A tap anywhere on the row opens the shard: the per-cell title only
          // exists on hover, and the sheet's chart carries the same numbers. Clicks
          // on the label button bubble here too, which keeps the keyboard path.
          return (
            <div key={s.id} className="contents" onClick={() => onOpen(s.id)}>
              <button
                type="button"
                className={cn("truncate pr-1 text-right font-mono text-[10px] leading-none text-muted-foreground hover:text-foreground", rowClass)}
                aria-label={`Shard ${s.id} details`}
              >
                {shards.length <= 16 || Number(s.id) % (shards.length > 40 ? 10 : 5) === 0 ? s.id : ""}
              </button>
              {times.map((t) => {
                const count = byTime.has(t) ? byTime.get(t)! : null;
                return (
                  <div
                    key={t}
                    title={hydrated ? `Shard ${s.id} · ${formatTime(t)} · ${count === null ? "no heartbeat" : `${count} events`}` : undefined}
                    className={cn("cursor-pointer", rowClass)}
                    style={
                      count === null
                        ? GAP_STYLE
                        : { backgroundColor: `color-mix(in oklab, var(--chart-1) ${Math.round(15 + 85 * (count / max))}%, transparent)` }
                    }
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid text-[10px] text-muted-foreground" style={{ gridTemplateColumns: `3rem repeat(${times.length}, minmax(0, 1fr))` }}>
        <span />
        {times.map((t, i) => (
          // Every other label drops out on a phone, where six of them run into each other.
          <span key={t} className={cn("overflow-visible whitespace-nowrap", (i / labelEvery) % 2 === 1 && "max-md:invisible")}>
            {hydrated && i % labelEvery === 0 ? formatTime(t) : ""}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Select a row to open that shard.</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm border" style={GAP_STYLE} aria-hidden="true" /> no heartbeat (down or not running)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ backgroundColor: "color-mix(in oklab, var(--chart-1) 15%, transparent)" }} aria-hidden="true" />
          quiet
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-[var(--chart-1)]" aria-hidden="true" /> busiest ({max.toLocaleString("en-US")} / 5m)
        </span>
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-1.5 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right break-all tabular-nums">{children}</dd>
    </div>
  );
}

const when = (iso: string | null | undefined) =>
  iso ? (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </time>
  ) : (
    "—"
  );

function ShardSheet({
  shard,
  series,
  lifecycle,
  onClose,
}: {
  shard: ShardView | null;
  series: EventsubShardThroughputPoint[];
  lifecycle: LifecycleRow[];
  onClose: () => void;
}) {
  const hb = shard?.heartbeat;
  const rows = shard ? lifecycle.filter((r) => r.shardIds.includes(shard.id)).slice(0, 20) : [];
  const chartData = series.map((p) => ({ time: formatTime(p.time), value: p.count }));
  const hasData = series.some((p) => p.count !== null);
  return (
    <Sheet open={shard !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {shard && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                <span className="font-mono">Shard #{shard.id}</span>
                <ShardStatus shard={shard} />
              </SheetTitle>
              <SheetDescription>{shard.detail}</SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-4 pb-6">
              <section>
                <h3 className="mb-1 text-sm font-medium">Helix transport</h3>
                <dl>
                  <DetailRow label="Status">{shard.helix ? shard.helix.status.replace(/_/g, " ") : "—"}</DetailRow>
                  <DetailRow label="Session">
                    <code className="font-mono text-xs">{shard.helix?.sessionId ?? "—"}</code>
                  </DetailRow>
                  <DetailRow label="Connected at">{when(shard.helix?.connectedAt)}</DetailRow>
                  <DetailRow label="Disconnected at">{when(shard.helix?.disconnectedAt)}</DetailRow>
                </dl>
              </section>
              <section>
                <h3 className="mb-1 text-sm font-medium">
                  Bot
                  {shard.stale && (
                    <span className="ml-2 font-normal text-red-600 dark:text-red-400">
                      as of the last heartbeat, {age(shard.heartbeatAgeMs)} ago
                    </span>
                  )}
                </h3>
                <dl>
                  <DetailRow label="State">{shard.botState ?? "—"}</DetailRow>
                  <DetailRow label="Session">
                    <code className="font-mono text-xs">{hb?.sessionId ?? "—"}</code>
                  </DetailRow>
                  <DetailRow label="Session age">{hb?.sessionAgeS != null ? formatElapsed(hb.sessionAgeS * 1000) : "—"}</DetailRow>
                  <DetailRow label="Last message">{age(hb?.lastMessageAgeMs)} ago</DetailRow>
                  <DetailRow label="Heartbeat">{age(shard.heartbeatAgeMs)} ago</DetailRow>
                  <DetailRow label="Events / min">{shard.eventsPerMin ?? "—"}</DetailRow>
                  <DetailRow label="Reconnect attempts now">{hb?.reconnectAttempts ?? "—"}</DetailRow>
                  <DetailRow label="Outages (24h)">{shard.lost24h}</DetailRow>
                </dl>
              </section>
              <section>
                <h3 className="mb-2 text-sm font-medium">Notifications, last 6h</h3>
                <ChartBody isEmpty={!hasData} height={140}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="time" tick={AXIS_TICK} className="fill-muted-foreground" minTickGap={24} />
                    <YAxis tick={AXIS_TICK} className="fill-muted-foreground" width={32} allowDecimals={false} />
                    <ChartTooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [v ?? "no heartbeat", "Events"]} />
                    <Area type="monotone" dataKey="value" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.15} strokeWidth={2} connectNulls={false} />
                  </AreaChart>
                </ChartBody>
              </section>
              <section>
                <h3 className="mb-2 text-sm font-medium">Lifecycle, last 24h</h3>
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No connection events for this shard.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {rows.map((r) => (
                      <li key={r.id} className="flex items-baseline justify-between gap-3">
                        <span>{r.type.replace("eventsub.", "").replace(/_/g, " ")}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{when(r.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function EventsubShardGrid({
  shards,
  throughput,
  lifecycle,
  generatedAt,
  initialView,
}: {
  shards: ShardView[];
  throughput: EventsubShardThroughputPoint[];
  lifecycle: LifecycleRow[];
  generatedAt: string;
  initialView: ShardGridView;
}) {
  const [view, setView] = useState<ShardGridView>(initialView);
  const [openId, setOpenId] = useState<string | null>(null);
  const byShard = useMemo(
    () => padShardThroughput(throughput, shards.map((s) => s.id), generatedAt),
    [throughput, shards, generatedAt],
  );
  const open = shards.find((s) => s.id === openId) ?? null;
  const layout = shards.length <= TILE_VIEW_MAX_SHARDS ? "tiles" : "strip";

  const changeView = (next: string) => {
    if (next !== "grid" && next !== "heatmap") return;
    setView(next);
    writeDashboardCookie(DASHBOARD_COOKIE.eventsubShardView, next);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          Shards
          <Badge variant="secondary" className="tabular-nums">
            {shards.length}
          </Badge>
        </CardTitle>
        <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={changeView} aria-label="Shard view">
          <ToggleGroupItem value="grid" className="h-11 px-3 md:h-8 md:px-2">
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            {layout === "tiles" ? "Tiles" : "Strip"}
          </ToggleGroupItem>
          <ToggleGroupItem value="heatmap" className="h-11 px-3 md:h-8 md:px-2">
            <Grid3x3 className="h-4 w-4" aria-hidden="true" />
            Heatmap
          </ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent>
        {shards.length === 0 ? (
          <ChartEmptyState height={160} message="No shards reported by Helix or the bot yet" />
        ) : view === "heatmap" ? (
          <ShardHeatmap shards={shards} byShard={byShard} onOpen={setOpenId} />
        ) : layout === "tiles" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {shards.map((s) => (
              <ShardTile key={s.id} shard={s} series={byShard.get(s.id) ?? []} onOpen={() => setOpenId(s.id)} />
            ))}
          </div>
        ) : (
          <ShardStrip shards={shards} onOpen={setOpenId} />
        )}
      </CardContent>
      <ShardSheet shard={open} series={open ? (byShard.get(open.id) ?? []) : []} lifecycle={lifecycle} onClose={() => setOpenId(null)} />
    </Card>
  );
}
