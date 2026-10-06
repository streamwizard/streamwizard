import {
  queryWsConnections,
  queryWsMessages,
  queryWsAuthFailures,
  queryWsDroppedMessages,
  queryWsConnectionDuration,
  queryWsRoomEvents,
  queryWsActiveConnectionsEstimate,
  queryWsTopMessageTypes,
} from "@repo/metrics";
import type {
  WsConnectionPoint,
  WsMessagePoint,
  WsAuthFailurePoint,
  WsMessageDropPoint,
  WsConnectionDurationPoint,
  WsRoomEventPoint,
  WsTopMessageTypePoint,
} from "@repo/metrics";
import { WsConnectionChart } from "@/components/charts/ws-connection-chart";
import { WsMessageChart } from "@/components/charts/ws-message-chart";
import { WsAuthFailureChart } from "@/components/charts/ws-auth-failure-chart";
import { WsMessageDropChart } from "@/components/charts/ws-message-drop-chart";
import { WsConnectionDurationChart } from "@/components/charts/ws-connection-duration-chart";
import { WsTopEventsTable } from "@/components/charts/ws-top-events-table";
import { PageHeader } from "@/components/widgets/page-header";
import { SectionHeading } from "@/components/widgets/section-heading";
import { StatCard } from "@/components/widgets/stat-card";
import { ChartGrid, StatGrid } from "@/components/widgets/stat-grid";

export const dynamic = "force-dynamic";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

/** Sum of the points from the last hour, as of this request. */
function lastHourTotal(points: { time: string; count: number }[]): number {
  const since = Date.now() - 3_600_000;
  return points.filter((p) => new Date(p.time).getTime() > since).reduce((acc, p) => acc + p.count, 0);
}

export default async function WsDashboard() {
  let connections: WsConnectionPoint[] = [];
  let messages: WsMessagePoint[] = [];
  let authFailures: WsAuthFailurePoint[] = [];
  let droppedMessages: WsMessageDropPoint[] = [];
  let connectionDuration: WsConnectionDurationPoint[] = [];
  let roomEvents: WsRoomEventPoint[] = [];
  let activeConnections: { role: string; active: number }[] = [];
  let topMessageTypes: WsTopMessageTypePoint[] = [];

  try {
    [
      connections,
      messages,
      authFailures,
      droppedMessages,
      connectionDuration,
      roomEvents,
      activeConnections,
      topMessageTypes,
    ] = await Promise.all([
      queryWsConnections("24h", "1h"),
      queryWsMessages("24h", "1h"),
      queryWsAuthFailures("24h", "1h"),
      queryWsDroppedMessages("24h", "1h"),
      queryWsConnectionDuration("24h", "1h"),
      queryWsRoomEvents("24h", "1h"),
      queryWsActiveConnectionsEstimate(),
      queryWsTopMessageTypes("24h"),
    ]);
  } catch {
    // InfluxDB not available — show empty state
  }

  // Compute stat card values
  const totalActive = activeConnections.reduce((acc, c) => acc + c.active, 0);

  const authFailureCount1h = lastHourTotal(authFailures);
  const dropCount1h = lastHourTotal(droppedMessages);

  const publisherDurations = connectionDuration.filter((d) => d.role === "publisher");
  const avgPublisherDurationMs =
    publisherDurations.length > 0
      ? publisherDurations.reduce((acc, d) => acc + d.avgMs, 0) / publisherDurations.length
      : null;

  const roomsCreated = roomEvents.filter((e) => e.event === "created").reduce((acc, e) => acc + e.count, 0);
  const roomsDeleted = roomEvents.filter((e) => e.event === "deleted").reduce((acc, e) => acc + e.count, 0);
  const estimatedActiveRooms = Math.max(0, roomsCreated - roomsDeleted);

  return (
    <div className="space-y-8">
      <PageHeader title="WebSocket" description="Connections, errors and message flow for ws-server. The health numbers load once with the page. The charts follow the header range and refresh." />

      {/* Section 1: Health Summary */}
      <section className="space-y-3">
        <SectionHeading>Health</SectionHeading>
        <StatGrid cols={5}>
          <StatCard
            title="Active connections"
            value={totalActive}
            description="Estimated (opens − closes)"
          />
          <StatCard
            title="Auth failures (1h)"
            value={authFailureCount1h}
            description={authFailureCount1h === 0 ? "All good" : "Check Errors section"}
            className={authFailureCount1h > 0 ? "border-destructive/50" : undefined}
          />
          <StatCard
            title="Dropped messages (1h)"
            value={dropCount1h}
            description={dropCount1h === 0 ? "All good" : "Check Errors section"}
            className={dropCount1h > 0 ? "border-destructive/50" : undefined}
          />
          <StatCard
            title="Publisher duration (avg)"
            value={avgPublisherDurationMs !== null ? formatDuration(avgPublisherDurationMs) : "—"}
            description="How long publishers stay connected"
          />
          <StatCard
            title="Active rooms"
            value={estimatedActiveRooms}
            description="Estimated (created − deleted)"
          />
        </StatGrid>
      </section>

      {/* Section 2: Connection Flow */}
      <section className="space-y-3">
        <SectionHeading>Connection flow</SectionHeading>
        <ChartGrid>
          <WsConnectionChart initialData={connections} />
          <WsConnectionDurationChart initialData={connectionDuration} />
        </ChartGrid>
      </section>

      {/* Section 3: Errors */}
      <section className="space-y-3">
        <SectionHeading>
          Errors
          {authFailureCount1h + dropCount1h > 0 && (
            <span className="ml-2 text-destructive normal-case font-normal">
              {authFailureCount1h + dropCount1h} in the last hour
            </span>
          )}
        </SectionHeading>
        <ChartGrid>
          <WsAuthFailureChart initialData={authFailures} />
          <WsMessageDropChart initialData={droppedMessages} />
        </ChartGrid>
      </section>

      {/* Section 4: Message Flow */}
      <section className="space-y-3">
        <SectionHeading>Message flow</SectionHeading>
        <ChartGrid>
          <WsMessageChart initialData={messages} />
          <WsTopEventsTable initialData={topMessageTypes} />
        </ChartGrid>
      </section>
    </div>
  );
}
