import { Activity, Cpu, Gauge, KeyRound, ListOrdered, Sparkles } from "lucide-react";
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
import { SupabaseHealthBanner, SupabaseKpiTiles } from "@/components/charts/supabase-health";
import { LiveIndicator } from "@/components/widgets/live-indicator";
import { PageHeader } from "@/components/widgets/page-header";
import { SectionHeading } from "@/components/widgets/section-heading";
import { homeEnv } from "@/lib/home-env";
import { EMPTY_SUPABASE_METRICS, fetchSupabaseMetrics, type SupabaseMetrics } from "@/lib/supabase-metrics";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
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
        title="Supabase platform"
        description={`Database host metrics for ${homeEnv()} · scraped by Telegraf every minute`}
      >
        <LiveIndicator />
      </PageHeader>

      <SupabaseHealthBanner initialSnapshot={m.snapshot} />

      <section className="space-y-3">
        <SectionHeading icon={Gauge}>Saturation</SectionHeading>
        <SupabaseKpiTiles initialSnapshot={m.snapshot} />
      </section>

      <section className="space-y-3">
        <SectionHeading icon={Activity}>Load &amp; latency</SectionHeading>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading icon={Cpu}>Resources</SectionHeading>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading icon={Sparkles}>Efficiency</SectionHeading>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading icon={ListOrdered}>Top queries</SectionHeading>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              By total execution time, since the last stats reset
            </CardTitle>
          </CardHeader>
          <CardContent>
            {queryStats.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No query stats — the admin_query_stats migration isn&apos;t applied to this database yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Mean</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queryStats.map((q, i) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-xl">
                        <code className="block truncate font-mono text-xs" title={q.query}>
                          {q.query.replace(/\s+/g, " ")}
                        </code>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{q.calls.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{q.mean_exec_ms.toFixed(2)} ms</TableCell>
                      <TableCell className="text-right tabular-nums">{(q.total_exec_ms / 1000).toFixed(2)} s</TableCell>
                      <TableCell className="text-right tabular-nums">{q.rows_returned.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeading icon={KeyRound}>Auth &amp; storage</SectionHeading>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Auth API calls · per route, last 24h
            </CardTitle>
          </CardHeader>
          <CardContent>
            {authRoutes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No auth API traffic in this range.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Route</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Mean latency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {authRoutes.map((r) => (
                    <TableRow key={`${r.method} ${r.route}`}>
                      <TableCell className="font-mono text-xs">{r.route}</TableCell>
                      <TableCell className="text-muted-foreground">{r.method}</TableCell>
                      <TableCell className="text-right tabular-nums">{Math.round(r.count).toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.meanMs.toFixed(1)} ms</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
