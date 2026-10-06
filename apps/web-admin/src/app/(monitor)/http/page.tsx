import { queryHttpRequestCount, queryHttpRequests, queryHttpRouteStats } from "@repo/metrics";
import type { HttpRequestPoint, HttpRouteStatPoint } from "@repo/metrics";
import { HttpRequestChart } from "@/components/charts/http-request-chart";
import { HttpRouteTable } from "@/components/charts/http-route-table";
import { PageHeader } from "@/components/widgets/page-header";
import { StatCard } from "@/components/widgets/stat-card";
import { StatGrid } from "@/components/widgets/stat-grid";

export const dynamic = "force-dynamic";

// The stat cards are read once, for this window, when the page loads. The
// chart and the route list below poll and follow the header range instead.
const STATS_RANGE = "24h";
const STATS_WINDOW = "Last 24 hours, at page load";

export default async function HttpDashboard() {
  let requests: HttpRequestPoint[] = [];
  let routeStats: HttpRouteStatPoint[] = [];
  let counts: { time: string; count: number; status: string }[] = [];

  try {
    [requests, routeStats, counts] = await Promise.all([
      queryHttpRequests(STATS_RANGE, "1h"),
      queryHttpRouteStats(STATS_RANGE),
      queryHttpRequestCount(STATS_RANGE),
    ]);
  } catch {
    // InfluxDB not available — show empty state
  }

  // Real request counts, not the number of aggregated points on the chart.
  const totalRequests = counts.reduce((acc, c) => acc + c.count, 0);
  const errorCount = counts.filter((c) => Number(c.status) >= 400).reduce((acc, c) => acc + c.count, 0);
  // Weighted by each route's request count, so a busy route counts for more than a quiet one.
  const routeRequests = routeStats.reduce((acc, r) => acc + r.requestCount, 0);
  const avgLatency =
    routeRequests > 0 ? Math.round(routeStats.reduce((acc, r) => acc + r.avgDurationMs * r.requestCount, 0) / routeRequests) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="API"
        description="Requests, latency and errors for rest-api. The stat cards cover the last 24 hours and load once. The chart and routes follow the header range and refresh."
      />

      <StatGrid cols={3}>
        <StatCard title="Total requests" value={totalRequests.toLocaleString("en-US")} description={STATS_WINDOW} />
        <StatCard title="Avg latency" value={avgLatency === null ? "—" : `${avgLatency}ms`} description={STATS_WINDOW} />
        <StatCard title="Errors (4xx/5xx)" value={errorCount.toLocaleString("en-US")} description={STATS_WINDOW} />
      </StatGrid>

      <HttpRequestChart initialData={requests} />
      <HttpRouteTable initialData={routeStats} />
    </div>
  );
}
