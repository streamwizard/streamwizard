"use client";

import { useMemo, useState } from "react";
import { Activity, Gauge, Layers, ListChecks, Radio, ScrollText } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  NativeSelect,
  NativeSelectOption,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import { SectionHeading } from "@/components/widgets/section-heading";
import { ChartEmptyState } from "@/components/widgets/chart-empty-state";
import { buildEventsubChecks, buildKpis, buildShardViews, COST_WARN_PCT } from "@/lib/eventsub-health";
import type { EventsubMetrics, LifecycleRow, SubscriptionInventory } from "@/lib/eventsub-metrics";
import { cn } from "@/lib/utils";
import { AXIS_TICK, CHART_TOOLTIP_STYLE, ChartBody, LEGEND_WRAPPER_STYLE, chartColor, stackByTime, useMetricsPoll } from "./chart-kit";
import { EventsubHealthBanner, EventsubKpiTiles } from "./eventsub-health";
import { EventsubShardGrid, type ShardGridView } from "./eventsub-shard-grid";

/** Types drawn as their own series in "Throughput by type"; the rest fold into "other". */
const TOP_TYPES = 6;

const TRANSPORT_LABEL: Record<string, string> = {
  websocket: "WebSocket (conduit)",
  webhook: "Webhook",
  unknown: "Untagged (before shards)",
};

function SourceError({ show, what }: { show: boolean; what: string }) {
  if (!show) return null;
  return (
    <p className="rounded-md border border-amber-500/50 px-3 py-2 text-sm text-amber-700 dark:text-amber-400" role="alert">
      Couldn&apos;t load {what} this time. Showing what the other sources returned.
    </p>
  );
}

function TransportSplit({ m }: { m: EventsubMetrics }) {
  const rows = stackByTime(m.transport, (p) => p.key);
  const keys = [...new Set(m.transport.map((p) => p.key))].sort();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Webhook vs WebSocket</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChartBody isEmpty={rows.length === 0}>
          <AreaChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="time" tick={AXIS_TICK} className="fill-muted-foreground" minTickGap={24} />
            <YAxis tick={AXIS_TICK} className="fill-muted-foreground" allowDecimals={false} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend wrapperStyle={LEGEND_WRAPPER_STYLE} />
            {keys.map((k, i) => (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                name={TRANSPORT_LABEL[k] ?? k}
                stackId="transport"
                stroke={chartColor(i)}
                fill={chartColor(i)}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ChartBody>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Webhook types (rest-api):</span>
          {m.webhookTypes.map((t) => (
            <Badge key={t} variant="outline" className="font-mono font-normal">
              {t}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CostBar({ subs }: { subs: SubscriptionInventory }) {
  const pct = subs.maxTotalCost > 0 ? Math.min(100, (100 * subs.totalCost) / subs.maxTotalCost) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">Cost</span>
        <span className="tabular-nums">
          {subs.totalCost.toLocaleString("en-US")} / {subs.maxTotalCost.toLocaleString("en-US")} ({pct.toFixed(pct < 1 ? 2 : 0)}%)
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={subs.maxTotalCost}
        aria-valuenow={subs.totalCost}
        aria-label="Subscription cost used"
      >
        <div
          className={cn("h-full rounded-full", pct > COST_WARN_PCT ? "bg-amber-500" : "bg-[var(--chart-2)]")}
          style={{ width: `${Math.max(pct, subs.totalCost > 0 ? 1 : 0)}%` }}
        />
      </div>
    </div>
  );
}

function SubscriptionInventoryCard({ m }: { m: EventsubMetrics }) {
  const subs = m.subscriptions;
  const missing = useMemo(() => {
    if (!subs) return [];
    const present = new Set(subs.types.map((t) => t.type));
    return [...new Set([...m.conduitTypes, ...m.webhookTypes])].filter((t) => !present.has(t)).sort();
  }, [subs, m.conduitTypes, m.webhookTypes]);

  if (!m.helixConfigured) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Helix isn&apos;t configured here: set TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET and TWITCH_CONDUIT_ID.
        </CardContent>
      </Card>
    );
  }
  if (!subs) {
    return (
      <Card>
        <CardContent className="py-8">
          <ChartEmptyState height={120} message="Subscription inventory not loaded yet" />
        </CardContent>
      </Card>
    );
  }

  const statusEntries = Object.entries(subs.byStatus).sort((a, b) => b[1] - a[1]);
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {statusEntries.map(([status, count]) => (
            <Badge
              key={status}
              variant="outline"
              className={cn("gap-1.5 font-normal tabular-nums", status !== "enabled" && "border-amber-500/50 text-amber-700 dark:text-amber-400")}
            >
              {status.replace(/_/g, " ")} · {count.toLocaleString("en-US")}
            </Badge>
          ))}
          <span className="text-xs text-muted-foreground">
            {subs.total.toLocaleString("en-US")} total · cached 5 min
            {subs.partial ? " · partial: scan stopped at 10,000" : ""}
          </span>
        </div>
        <CostBar subs={subs} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Transport</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Enabled</TableHead>
              <TableHead className="text-right">Other</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subs.types.map((t) => {
              const enabled = t.byStatus.enabled ?? 0;
              const other = t.total - enabled;
              return (
                <TableRow key={`${t.type}|${t.transport}`}>
                  <TableCell className="font-mono text-xs">
                    {t.type}
                    {!t.expected && (
                      <Badge variant="outline" className="ml-2 font-sans font-normal">
                        not in our lists
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {t.transport}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t.total.toLocaleString("en-US")}</TableCell>
                  <TableCell className="text-right tabular-nums">{enabled.toLocaleString("en-US")}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", other > 0 && "font-medium text-amber-700 dark:text-amber-400")}>
                    {other.toLocaleString("en-US")}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {missing.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            No subscriptions yet for: {missing.map((t) => <code key={t} className="mr-2 font-mono">{t}</code>)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ThroughputByType({ m }: { m: EventsubMetrics }) {
  const top = m.typeTotals.slice(0, TOP_TYPES).map((t) => t.eventType);
  const topSet = new Set(top);
  const rows = stackByTime(m.eventsByType, (p) => (topSet.has(p.key) ? p.key : "other"));
  const series = rows.some((r) => "other" in r) ? [...top, "other"] : top;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Events by type</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartBody isEmpty={rows.length === 0} height={280}>
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="time" tick={AXIS_TICK} className="fill-muted-foreground" minTickGap={24} />
              <YAxis tick={AXIS_TICK} className="fill-muted-foreground" allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={LEGEND_WRAPPER_STYLE} />
              {series.map((k, i) => (
                <Bar key={k} dataKey={k} stackId="types" fill={k === "other" ? "var(--muted-foreground)" : chartColor(i)} />
              ))}
            </BarChart>
          </ChartBody>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Handled vs no bot handler</CardTitle>
        </CardHeader>
        <CardContent>
          {m.typeTotals.length === 0 ? (
            <ChartEmptyState height={200} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Handled</TableHead>
                  <TableHead className="text-right">No handler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.typeTotals.slice(0, 15).map((t) => (
                  <TableRow key={t.eventType}>
                    <TableCell className="max-w-48 truncate font-mono text-xs" title={t.eventType}>
                      {t.eventType}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{t.handled.toLocaleString("en-US")}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{t.unhandled.toLocaleString("en-US")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            &ldquo;No handler&rdquo; is normal for overlay-only types: the bot forwards them without handling them itself.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function lifecycleDetail(r: LifecycleRow): string {
  if (r.downtimeMs !== null) return `down ${Math.round(r.downtimeMs / 1000)}s`;
  if (r.error) return r.error;
  if (r.reason) return r.closeCode !== null ? `${r.reason} (${r.closeCode})` : r.reason;
  return "";
}

const LIFECYCLE_TONE: Record<string, string> = {
  "eventsub.connection_lost": "text-red-600 dark:text-red-400",
  "eventsub.conduit_update_failed": "text-red-600 dark:text-red-400",
  "eventsub.subscription_revoked": "text-amber-700 dark:text-amber-400",
  "eventsub.reconnected": "text-emerald-600 dark:text-emerald-400",
};

function LifecycleTimeline({ rows }: { rows: LifecycleRow[] }) {
  const [shard, setShard] = useState("all");
  const shardIds = useMemo(() => [...new Set(rows.map((r) => r.shardId ?? "0"))].sort((a, b) => Number(a) - Number(b)), [rows]);
  const visible = shard === "all" ? rows : rows.filter((r) => r.shardId === shard);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Last 24 hours</CardTitle>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Shard
          <NativeSelect value={shard} onChange={(e) => setShard(e.target.value)} size="sm">
            <NativeSelectOption value="all">All</NativeSelectOption>
            {shardIds.map((id) => (
              <NativeSelectOption key={id} value={id}>
                #{id}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <ChartEmptyState height={120} message="No EventSub lifecycle events in the last 24 hours" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Shard</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.slice(0, 100).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums">
                    <time dateTime={r.createdAt} suppressHydrationWarning>
                      {new Date(r.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </time>
                  </TableCell>
                  <TableCell className={cn("text-sm", LIFECYCLE_TONE[r.type])}>{r.type.replace("eventsub.", "").replace(/_/g, " ")}</TableCell>
                  <TableCell className="font-mono text-xs">#{r.shardId}</TableCell>
                  <TableCell className="max-w-72 truncate text-xs text-muted-foreground" title={lifecycleDetail(r)}>
                    {lifecycleDetail(r)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function EventsubDashboard({ initialData, initialView }: { initialData: EventsubMetrics; initialView: ShardGridView }) {
  const polled = useMetricsPoll<EventsubMetrics | { error: string }>("/api/metrics/eventsub", initialData);
  // A 401 (session expired) or 400 comes back as { error }; keep the last good payload.
  const m = "generatedAt" in polled ? polled : initialData;

  const shards = useMemo(() => buildShardViews(m), [m]);
  const checks = useMemo(() => buildEventsubChecks(m, shards), [m, shards]);
  const kpis = useMemo(() => buildKpis(m, shards), [m, shards]);

  return (
    <div className="space-y-8">
      <EventsubHealthBanner checks={checks} generatedAt={m.generatedAt} />

      <section className="space-y-3">
        <SectionHeading icon={Gauge}>At a glance</SectionHeading>
        <EventsubKpiTiles kpis={kpis} checks={checks} />
      </section>

      <section className="space-y-3">
        <SectionHeading icon={Layers}>Shards</SectionHeading>
        <SourceError show={m.errors.helix} what="the conduit from Helix" />
        <EventsubShardGrid
          shards={shards}
          throughput={m.shardThroughput}
          lifecycle={m.lifecycle}
          generatedAt={m.generatedAt}
          initialView={initialView}
        />
      </section>

      <section className="space-y-3">
        <SectionHeading icon={Radio}>Transport split</SectionHeading>
        <SourceError show={m.errors.influx} what="some InfluxDB series" />
        <TransportSplit m={m} />
      </section>

      <section className="space-y-3">
        <SectionHeading icon={ListChecks}>Subscription inventory</SectionHeading>
        <SourceError show={m.errors.subscriptions} what="the subscription list from Helix" />
        <SubscriptionInventoryCard m={m} />
      </section>

      <section className="space-y-3">
        <SectionHeading icon={Activity}>Throughput by type</SectionHeading>
        <ThroughputByType m={m} />
      </section>

      <section className="space-y-3">
        <SectionHeading icon={ScrollText}>Lifecycle</SectionHeading>
        <SourceError show={m.errors.lifecycle} what="the event log" />
        <LifecycleTimeline rows={m.lifecycle} />
      </section>
    </div>
  );
}

export type { ShardGridView };
