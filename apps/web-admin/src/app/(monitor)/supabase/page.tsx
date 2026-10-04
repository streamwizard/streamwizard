import { Activity, ChevronRight, Cpu, Gauge, KeyRound, ListOrdered, Sparkles } from "lucide-react";
import {
  querySupabaseAuthRoutes,
  querySupabaseDbSizes,
  type AuthRouteStat,
  type DatabaseSize,
} from "@repo/metrics";
import {
  SUPABASE_DB_CPU_WARN_PCT,
  SUPABASE_DB_DISK_WARN_PCT,
} from "@repo/alerting/thresholds";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getQueryStats, type QueryStat } from "@repo/supabase/queries/query-stats";
import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { PlatformMetricChart } from "@/components/charts/platform-metric-chart";
import { PlatformMultiSeriesChart } from "@/components/charts/platform-multi-series-chart";
import { HealthSection, SupabaseHealthBanner, SupabaseKpiTiles } from "@/components/charts/supabase-health";
import { DataList } from "@/components/widgets/data-list";
import { LiveIndicator } from "@/components/widgets/live-indicator";
import { PageHeader } from "@/components/widgets/page-header";
import { SectionHeading } from "@/components/widgets/section-heading";
import { ChartGrid } from "@/components/widgets/stat-grid";
import { homeEnv } from "@/lib/home-env";
import { EMPTY_SUPABASE_METRICS, fetchSupabaseMetrics, type SupabaseMetrics } from "@/lib/supabase-metrics";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

const SECTION_ICON = "h-4 w-4";

/** The query on one or two lines, the whole statement behind a tap: a title attribute never opens on a phone. */
function QueryText({ query }: { query: string }) {
  return (
    <details className="group min-w-0 font-normal">
      <summary className="flex min-h-11 cursor-pointer list-none items-start gap-1.5 rounded-sm py-1 sm:min-h-0 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
        <code className="line-clamp-2 font-mono text-xs break-all whitespace-normal group-open:hidden">{query.replace(/\s+/g, " ")}</code>
        <span className="hidden text-xs text-muted-foreground group-open:inline">Full query</span>
      </summary>
      <pre className="mt-1 max-h-80 overflow-y-auto rounded-md bg-muted p-3 font-mono text-xs break-words whitespace-pre-wrap">{query}</pre>
    </details>
  );
}

export default async function SupabasePlatformPage() {
  let m: SupabaseMetrics = EMPTY_SUPABASE_METRICS;
  let sizes: DatabaseSize[] = [];
  let authRoutes: AuthRouteStat[] = [];
  let queryStats: QueryStat[] = [];

  try {
    [m, sizes, authRoutes] = await Promise.all([
      fetchSupabaseMetrics("24h", "1h"),
      querySupabaseDbSizes(),
      querySupabaseAuthRoutes("24h"),
    ]);
  } catch {
    // InfluxDB unavailable — page renders with empty states.
  }

  try {
    queryStats = await getQueryStats(supabaseAdmin, 25);
  } catch {
    // admin_query_stats RPC not deployed to this database yet.
  }

  const maxConnections = m.snapshot?.maxConnections ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Database health"
        description={`Database host metrics for ${homeEnv()} · scraped by Telegraf every minute`}
      >
        <LiveIndicator />
      </PageHeader>

      <SupabaseHealthBanner initialSnapshot={m.snapshot} />

      <section className="space-y-3">
        <SectionHeading icon={Gauge}>Saturation</SectionHeading>
        <SupabaseKpiTiles initialSnapshot={m.snapshot} />
      </section>

      <HealthSection icon={<Activity className={SECTION_ICON} aria-hidden="true" />} title="Load and latency">
        <ChartGrid>
          <PlatformMetricChart title="Queries / sec" seriesKey="queryRate" initialData={m.queryRate} color={1} />
          <PlatformMetricChart title="Mean query time" seriesKey="meanQueryMs" initialData={m.meanQueryMs} unit="ms" color={4} />
          <PlatformMultiSeriesChart
            title="Transactions / sec"
            seriesKey="transactions"
            initialData={m.transactions}
            stacked
            series={[
              { key: "commit", label: "Commit", color: 2 },
              { key: "rollback", label: "Rollback", color: 4 },
            ]}
          />
          <PlatformMetricChart title="Rollback share" seriesKey="rollbackPct" initialData={m.rollbackPct} unit="%" color={4} />
        </ChartGrid>
      </HealthSection>

      <HealthSection icon={<Cpu className={SECTION_ICON} aria-hidden="true" />} title="Resources">
        <ChartGrid>
          <PlatformMultiSeriesChart
            title="DB CPU %"
            seriesKey="cpuBreakdown"
            initialData={m.cpuBreakdown}
            stacked
            unit="%"
            yMax={100}
            reference={{ value: SUPABASE_DB_CPU_WARN_PCT, label: `warn ${SUPABASE_DB_CPU_WARN_PCT}%` }}
            series={[
              { key: "busy", label: "Busy", color: 1 },
              { key: "iowait", label: "Waiting on disk (iowait)", color: 3 },
            ]}
          />
          <PlatformMetricChart
            title="Connections"
            seriesKey="connections"
            initialData={m.connections}
            color={4}
            reference={maxConnections ? { value: maxConnections, label: `max ${maxConnections}` } : undefined}
          />
          <PlatformMetricChart title="Memory %" seriesKey="memory" initialData={m.memory} unit="%" color={2} yMax={100} />
          <PlatformMetricChart title="Swap used %" seriesKey="swap" initialData={m.swap} unit="%" color={3} yMax={100} />
          <PlatformMetricChart
            title="Disk % (/data)"
            seriesKey="disk"
            initialData={m.disk}
            unit="%"
            color={3}
            yMax={100}
            reference={{ value: SUPABASE_DB_DISK_WARN_PCT, label: `warn ${SUPABASE_DB_DISK_WARN_PCT}%` }}
          />
          <PlatformMultiSeriesChart
            title="Disk IO"
            seriesKey="diskIo"
            initialData={m.diskIo}
            format="bytesPerSec"
            series={[
              { key: "read", label: "Read", color: 1 },
              { key: "write", label: "Write", color: 2 },
            ]}
          />
        </ChartGrid>
      </HealthSection>

      <HealthSection icon={<Sparkles className={SECTION_ICON} aria-hidden="true" />} title="Efficiency">
        <ChartGrid cols={3}>
          <PlatformMetricChart title="Cache hit %" seriesKey="cacheHit" initialData={m.cacheHit} unit="%" color={2} yMin={95} yMax={100} />
          <PlatformMetricChart title="Temp file spill" seriesKey="tempBytes" initialData={m.tempBytes} format="bytesPerSec" color={3} />
          <PlatformMultiSeriesChart
            title="Rows / sec"
            seriesKey="rowActivity"
            initialData={m.rowActivity}
            series={[
              { key: "fetched", label: "Read", color: 1 },
              { key: "inserted", label: "Inserted", color: 2 },
              { key: "updated", label: "Updated", color: 3 },
              { key: "deleted", label: "Deleted", color: 4 },
            ]}
          />
        </ChartGrid>
      </HealthSection>

      <HealthSection icon={<ListOrdered className={SECTION_ICON} aria-hidden="true" />} title="Top queries">
        <Card>
          <CardHeader className="px-4 pb-2 sm:px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              By total execution time, since the last stats reset. Select a query to read all of it.
            </CardTitle>
          </CardHeader>
          {/* Phone cards run edge to edge; the table keeps the card's padding. */}
          <CardContent className="px-0 sm:px-6">
            {queryStats.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No query stats. The admin_query_stats migration isn&apos;t applied to this database yet.
              </p>
            ) : (
              <DataList
                rows={queryStats.map((q, i) => ({ ...q, rank: i }))}
                rowKey={(q) => String(q.rank)}
                columns={[
                  {
                    key: "query",
                    header: "Query",
                    mobile: "title",
                    className: "max-w-xl whitespace-normal",
                    cell: (q) => <QueryText query={q.query} />,
                  },
                  {
                    key: "calls",
                    header: "Calls",
                    headClassName: "text-right",
                    className: "text-right align-top tabular-nums",
                    cell: (q) => <span className="tabular-nums">{q.calls.toLocaleString("en-US")}</span>,
                  },
                  {
                    key: "mean",
                    header: "Mean",
                    headClassName: "text-right",
                    className: "text-right align-top tabular-nums",
                    cell: (q) => <span className="tabular-nums">{q.mean_exec_ms.toFixed(2)} ms</span>,
                  },
                  {
                    key: "total",
                    header: "Total",
                    headClassName: "text-right",
                    className: "text-right align-top tabular-nums",
                    cell: (q) => <span className="tabular-nums">{(q.total_exec_ms / 1000).toFixed(2)} s</span>,
                  },
                  {
                    key: "rows",
                    header: "Rows",
                    // The phone card keeps the three timing numbers; rows returned stays on the table.
                    mobile: "hidden",
                    headClassName: "text-right",
                    className: "text-right align-top tabular-nums",
                    cell: (q) => q.rows_returned.toLocaleString("en-US"),
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>
      </HealthSection>

      <HealthSection icon={<KeyRound className={SECTION_ICON} aria-hidden="true" />} title="Auth and storage">
        <ChartGrid>
          <PlatformMetricChart title="Auth API latency" seriesKey="authApiMs" initialData={m.authApiMs} unit="ms" color={4} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Database sizes</CardTitle>
            </CardHeader>
            <CardContent>
              {sizes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No size data yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Database</TableHead>
                      <TableHead className="text-right">Size</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sizes
                      .slice()
                      .sort((a, b) => b.sizeBytes - a.sizeBytes)
                      .map((s) => (
                        <TableRow key={s.database}>
                          <TableCell className="font-mono text-xs">{s.database}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatBytes(s.sizeBytes)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </ChartGrid>
        <Card>
          <CardHeader className="px-4 pb-2 sm:px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Auth API calls per route, last 24 hours at page load
            </CardTitle>
          </CardHeader>
          {/* Phone cards run edge to edge; the table keeps the card's padding. */}
          <CardContent className="px-0 sm:px-6">
            {authRoutes.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No auth API traffic in the last 24 hours.</p>
            ) : (
              <DataList
                rows={authRoutes}
                rowKey={(r) => `${r.method} ${r.route}`}
                columns={[
                  {
                    key: "route",
                    header: "Route",
                    mobile: "title",
                    className: "whitespace-normal",
                    cell: (r) => <span className="font-mono text-xs font-normal break-all">{r.route}</span>,
                  },
                  { key: "method", header: "Method", mobile: "badge", className: "text-muted-foreground", cell: (r) => r.method },
                  {
                    key: "calls",
                    header: "Calls",
                    headClassName: "text-right",
                    className: "text-right tabular-nums",
                    cell: (r) => <span className="tabular-nums">{Math.round(r.count).toLocaleString("en-US")}</span>,
                  },
                  {
                    key: "latency",
                    header: "Mean latency",
                    headClassName: "text-right",
                    className: "text-right tabular-nums",
                    cell: (r) => <span className="tabular-nums">{r.meanMs.toFixed(1)} ms</span>,
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>
      </HealthSection>
    </div>
  );
}
