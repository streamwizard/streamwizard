import { Activity, ArrowUpDown, Ban, Cable, ServerCrash, Timer } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { errorTone, formatErrorPct, formatMs } from "@/components/apps/app-format";
import { AppsNotice, MissingData } from "@/components/apps/apps-notice";
import { NodeMetricChart } from "@/components/charts/node-metric-chart";
import { PageTabs } from "@/components/page-tabs";
import { ErrorCodeTable } from "@/components/traefik/error-code-table";
import { SpeedBandChart } from "@/components/traefik/speed-band-chart";
import { TraefikAppTable } from "@/components/traefik/traefik-app-table";
import {
  CLIENT_ERRORS_HINT,
  CONNECTIONS_HINT,
  DATA_HINT,
  PROBLEMS_HINT,
  PROXY_HINT,
  REQUESTS_HINT,
  SERVER_ERRORS_HINT,
  SLOW_HINT,
  formatRequestRate,
  traefikApi,
  traefikHref,
} from "@/components/traefik/traefik-format";
import { AutoRefresh } from "@/components/vms/auto-refresh";
import { ChartSection } from "@/components/vms/chart-section";
import { Rate } from "@/components/vms/rate";
import { PageHeader } from "@/components/widgets/page-header";
import { StatCard } from "@/components/widgets/stat-card";
import { StatGrid } from "@/components/widgets/stat-grid";
import { fetchTraefikSeries, getTraefikOverview } from "@/lib/traefik";
import { SCOPES, SCOPE_LABEL, parseScope } from "@/lib/traefik-model";

export const dynamic = "force-dynamic";

const header = <PageHeader title="Traefik" description="Every request that reaches the server: errors, speed and volume per app. Live from Telegraf, every 30 seconds." />;

export default async function TraefikPage({ searchParams }: { searchParams: Promise<{ env?: string | string[] }> }) {
  const scope = parseScope((await searchParams).env);
  const [overview, series] = await Promise.all([getTraefikOverview(scope), fetchTraefikSeries(scope, "24h", "1h")]);

  if (overview.state !== "ok") {
    return (
      <div className="space-y-6">
        {overview.state !== "not-collected" && <AutoRefresh />}
        {header}
        <AppsNotice state={overview.state} />
      </div>
    );
  }
  const { totals, rows, openConnections, failed } = overview;
  const api = traefikApi(scope);
  // The rest of the server is somebody else's: same numbers, no status colours.
  const tone = (pct: number | null | undefined) => (scope === "other" ? "default" : errorTone(pct));
  const allScopes = scope === "all";

  return (
    <div className="space-y-6">
      <AutoRefresh />
      {header}
      <PageTabs
        label="Environment"
        variant="pills"
        tabs={SCOPES.map((s) => ({ href: traefikHref(s), label: SCOPE_LABEL[s], active: s === scope }))}
      />
      <MissingData failed={failed} />

      {/* Two rows of three: what can be wrong first, how much traffic there is second. */}
      <StatGrid cols={3}>
        <StatCard title="Server errors" hint={SERVER_ERRORS_HINT} value={formatErrorPct(totals?.serverErrorPct)} description="5xx answers" tone={tone(totals?.serverErrorPct)} icon={ServerCrash} />
        <StatCard title="Slow requests" hint={SLOW_HINT} value={formatErrorPct(totals?.slowPct)} description="over 1.2 s" tone={tone(totals?.slowPct)} icon={Timer} />
        <StatCard title="Client errors" hint={CLIENT_ERRORS_HINT} value={formatErrorPct(totals?.clientErrorPct)} description="4xx answers" icon={Ban} />
        <StatCard
          title="Requests"
          hint={REQUESTS_HINT}
          value={formatRequestRate(totals?.requestsPerSec)}
          description={totals?.meanMs == null ? undefined : `${formatMs(totals.meanMs)} mean response`}
          icon={Activity}
        />
        <StatCard
          title="Data out"
          hint={DATA_HINT}
          value={<Rate bps={totals?.bytesOutPerSec} />}
          description={
            totals ? (
              <>
                In <Rate bps={totals.bytesInPerSec} />
              </>
            ) : undefined
          }
          icon={ArrowUpDown}
        />
        <StatCard title="Open connections" hint={CONNECTIONS_HINT} value={openConnections == null ? "—" : Math.round(openConnections)} description="whole proxy" icon={Cable} />
      </StatGrid>

      <ChartSection title="Problems" hint={PROBLEMS_HINT}>
        <NodeMetricChart title="Errors, share of all answers" apiPath={api} dataKey="errorShare" initialData={series.errorShare} format="share" seriesOrder={["5xx", "4xx"]} />
        <SpeedBandChart title="Speed, share of HTTP requests" apiPath={api} initialData={series.speedBands} initialOrder={series.speedBandOrder} />
      </ChartSection>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base">Apps, last 5 minutes</CardTitle>
          <CardDescription>The app with trouble comes first. A row opens the app&apos;s own page.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <TraefikAppTable rows={rows} showEnv={allScopes} />
        </CardContent>
      </Card>

      <ErrorCodeTable apiPath={api} initialData={series.errors} showEnv={allScopes} />

      <ChartSection title="Traffic">
        <NodeMetricChart
          title="Requests per second, by protocol"
          apiPath={api}
          dataKey="requests"
          initialData={series.requests}
          format="perSec"
          seriesOrder={["HTTP", "WebSocket", "SSE"]}
        />
        <NodeMetricChart title="Data in and out" apiPath={api} dataKey="data" initialData={series.data} format="bytesPerSec" seriesOrder={["In", "Out"]} />
      </ChartSection>

      <ChartSection title="Whole proxy" hint={PROXY_HINT}>
        <NodeMetricChart
          title="Open connections, by entrypoint"
          apiPath={api}
          dataKey="connections"
          initialData={series.connections}
          format="number"
          seriesOrder={["websecure", "web", "traefik"]}
        />
        <NodeMetricChart
          title="Requests per second, by entrypoint"
          apiPath={api}
          dataKey="entrypoints"
          initialData={series.entrypoints}
          format="perSec"
          seriesOrder={["websecure", "web", "traefik"]}
        />
      </ChartSection>
    </div>
  );
}
