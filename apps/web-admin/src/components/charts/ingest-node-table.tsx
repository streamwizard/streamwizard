"use client";

import useSWR from "swr";
import { ArrowDown, ArrowDownToLine, ArrowUp, Radio, Server, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { ActiveIngestSignal } from "@repo/metrics";
import type { IngestNode as IngestNodeRow } from "@repo/supabase/queries/ingest-nodes";
import { FleetHealth, FleetState, RelativeTime, healthCheckText } from "@/components/admin/fleet-cells";
import type { NodeMetricPoint } from "@/components/charts/node-metric-chart";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import { StatCard } from "@/components/widgets/stat-card";
import { StatGrid } from "@/components/widgets/stat-grid";
import { fetcher, formatBandwidth } from "@/lib/utils";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { useBandwidthUnit } from "@/lib/bandwidth-unit-context";
import { useIngestLive } from "@/lib/ingest-live-context";
import type { FleetNode } from "@/lib/node-fleet";
import type { IngestNode } from "@/lib/ingest-nodes";

/** The registry columns the fleet list shows. Read once with the page; they
 *  only change when someone edits the node. */
export type IngestNodeFacts = Pick<IngestNodeRow, "id" | "name" | "status" | "maintenance" | "tailscale_ip" | "public_hostname" | "public_ip">;

/** One ingest box. `fleet` is null when the polled fleet did not include it,
 *  so the row shows from the registry alone, with blanks for the rest. */
export interface IngestNodeListRow {
  id: string;
  name: string;
  fleet: IngestNode | null;
  facts: IngestNodeFacts | null;
  /** Network, preferring the 1s socket reading over the polled snapshot. */
  rxBytesPerSec: number | null;
  txBytesPerSec: number | null;
}

// Amber past 75%, red past 90%, so "something's hot" reads the same on every
// resource column.
function pctClass(pct: number | null | undefined): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 90) return "text-red-600 dark:text-red-400";
  if (pct >= 75) return "text-amber-600 dark:text-amber-400";
  return "";
}

function pct(v: number | null | undefined): string {
  return v == null ? "—" : `${v.toFixed(0)}%`;
}

function ram(usedMb: number | null | undefined, totalMb: number | null | undefined): string {
  if (usedMb == null || !totalMb) return "—";
  return `${(usedMb / 1024).toFixed(1)} / ${(totalMb / 1024).toFixed(1)} GB`;
}

const NUMBER = "text-right tabular-nums";

/** One row per registered ingest node: registry state, live health and the
 *  latest host snapshot in a single list. */
export function IngestNodeTable({ rows }: { rows: IngestNodeListRow[] }) {
  const { unit } = useBandwidthUnit();

  // The table starts at a 672px list. Extra columns join as the list gets
  // wider (container variants, like DataList itself). The card layout shows
  // them all but load and the public address.
  const columns: DataColumn<IngestNodeListRow>[] = [
    {
      key: "node",
      header: "Node",
      mobile: "title",
      className: "max-w-64 whitespace-normal",
      cell: (row) => (
        <>
          <span className="font-medium">{row.name}</span>
          <span className="block font-mono text-xs font-normal break-all text-muted-foreground">
            {row.fleet?.address ?? row.facts?.tailscale_ip ?? "no address"}
          </span>
          <FleetState status={row.fleet?.status ?? row.facts?.status ?? null} maintenance={row.fleet?.maintenance ?? row.facts?.maintenance ?? false} />
        </>
      ),
    },
    { key: "health", header: "Health", mobile: "badge", cell: (row) => <FleetHealth node={row.fleet} /> },
    {
      // Cards only: the table shows this under the health label.
      key: "check",
      header: "Health check",
      className: "hidden",
      headClassName: "hidden",
      cell: (row) => healthCheckText(row.fleet),
    },
    {
      key: "cpu",
      header: "CPU",
      className: NUMBER,
      headClassName: "text-right",
      cell: (row) => <span className={pctClass(row.fleet?.cpuPct)}>{pct(row.fleet?.cpuPct)}</span>,
    },
    {
      key: "ram",
      header: "RAM",
      className: `text-muted-foreground ${NUMBER}`,
      headClassName: "text-right",
      cell: (row) => ram(row.fleet?.ramUsedMb, row.fleet?.ramTotalMb),
    },
    {
      key: "disk",
      header: "Disk",
      className: NUMBER,
      headClassName: "text-right",
      cell: (row) => <span className={pctClass(row.fleet?.diskUsedPct)}>{pct(row.fleet?.diskUsedPct)}</span>,
    },
    {
      key: "load",
      header: "Load",
      mobile: "hidden",
      className: `hidden text-muted-foreground @4xl:table-cell ${NUMBER}`,
      headClassName: "hidden text-right @4xl:table-cell",
      cell: (row) => (row.fleet?.loadAvg1 == null ? "—" : row.fleet.loadAvg1.toFixed(2)),
    },
    {
      key: "network",
      header: "Network",
      className: `hidden text-xs text-muted-foreground @3xl:table-cell ${NUMBER}`,
      headClassName: "hidden text-right @3xl:table-cell",
      cell: (row) =>
        row.rxBytesPerSec === null ? (
          "—"
        ) : (
          <span className="inline-flex flex-wrap items-center gap-x-2 @2xl:justify-end">
            <span className="inline-flex items-center gap-0.5">
              <ArrowDown className="h-3 w-3 text-emerald-500" aria-hidden />
              <span className="sr-only">In</span>
              {formatBandwidth(row.rxBytesPerSec, unit)}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <ArrowUp className="h-3 w-3 text-sky-500" aria-hidden />
              <span className="sr-only">Out</span>
              {formatBandwidth(row.txBytesPerSec ?? 0, unit)}
            </span>
          </span>
        ),
    },
    {
      // Where encoders connect: the public domain when one is set, else the IP.
      key: "public",
      header: "Public address",
      mobile: "hidden",
      className: "hidden font-mono text-xs text-muted-foreground @6xl:table-cell",
      headClassName: "hidden @6xl:table-cell",
      cell: (row) => row.facts?.public_hostname ?? row.facts?.public_ip ?? "—",
    },
    {
      key: "last",
      header: "Last seen",
      className: `hidden text-xs text-muted-foreground @4xl:table-cell ${NUMBER}`,
      headClassName: "hidden text-right @4xl:table-cell",
      cell: (row) => <RelativeTime iso={row.fleet?.lastMetricAt} />,
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 px-4 pb-2 sm:px-6">
        <CardTitle className="text-base">Nodes</CardTitle>
        <span className="text-xs text-muted-foreground tabular-nums">
          {rows.length} node{rows.length === 1 ? "" : "s"}
        </span>
      </CardHeader>
      {/* Phone cards run edge to edge; the table keeps the card's padding. */}
      <CardContent className="px-0 sm:px-6">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No nodes registered</p>
        ) : (
          <DataList rows={rows} rowKey={(row) => row.id} columns={columns} />
        )}
      </CardContent>
    </Card>
  );
}

export interface IngestFleetData {
  ingestNodes: IngestNode[];
  activeSignals: ActiveIngestSignal[];
  /** The fleet-wide CPU series; only used to count which nodes reported. */
  hostCpu: NodeMetricPoint[];
  fleet: FleetNode[];
}

interface IngestFleetOverviewProps {
  initial: Pick<IngestFleetData, "ingestNodes" | "activeSignals">;
  /** Nodes with host metrics in the range, counted on the server. */
  initialReporting: number;
  /** Null when the registry could not be read. */
  initialRegistered: number | null;
  facts: IngestNodeFacts[];
}

/** The Fleet tab above the charts: stats and the node list. One poll of the
 *  metrics API feeds both, so the numbers on top move with the rows. */
export function IngestFleetOverview({ initial, initialReporting, initialRegistered, facts }: IngestFleetOverviewProps) {
  const { interval } = useRefreshInterval();
  const { nodes: liveNodes } = useIngestLive();
  const { data } = useSWR<Partial<IngestFleetData>>("/api/metrics/ingest", fetcher, {
    fallbackData: initial,
    refreshInterval: interval,
  });

  const ingestNodes = data?.ingestNodes ?? initial.ingestNodes;
  const activeSignals = data?.activeSignals ?? initial.activeSignals;

  // Network prefers the 1s WebSocket reading over the polled InfluxDB snapshot
  // (registry node id == WS node_id == the InfluxDB node_id tag). Nodes
  // without a live entry (WS down, or an old image) keep the polled value.
  const liveById = new Map(liveNodes.map((n) => [n.nodeId, n]));
  const factsById = new Map(facts.map((node) => [node.id, node]));
  const rows: IngestNodeListRow[] = ingestNodes.map((node) => {
    const live = liveById.get(node.id);
    return {
      id: node.id,
      name: node.name,
      fleet: node,
      facts: factsById.get(node.id) ?? null,
      rxBytesPerSec: live ? live.rxBps : node.rxBytesPerSec,
      txBytesPerSec: live ? live.txBps : node.txBytesPerSec,
    };
  });
  // The polled fleet is the registry plus probes. When it comes back empty
  // (probe or registry trouble), fall back to the rows read with the page.
  if (rows.length === 0) {
    for (const node of facts) {
      const live = liveById.get(node.id);
      rows.push({ id: node.id, name: node.name, fleet: null, facts: node, rxBytesPerSec: live?.rxBps ?? null, txBytesPerSec: live?.txBps ?? null });
    }
  }

  // The API's error payload has an empty CPU series and no node list. Only a
  // full answer may move the count, or one failed poll would paint it red.
  const reporting = data?.hostCpu && data.ingestNodes ? new Set(data.hostCpu.map((p) => p.nodeId)).size : initialReporting;
  const registered = data?.fleet && data.fleet.length > 0 ? data.fleet.length : initialRegistered;
  const userCount = new Set(activeSignals.map((s) => s.userId)).size;
  const totalKbps = activeSignals.reduce((acc, s) => acc + s.kbps, 0);
  const totalIncoming = totalKbps >= 1000 ? `${(totalKbps / 1000).toFixed(1)} Mbps` : `${totalKbps.toFixed(0)} kbps`;

  // Node health drives the card colour: green when every registered node is
  // reporting, amber when some are silent, red when nothing is reporting.
  const nodesTone = reporting === 0 ? "danger" : registered !== null && reporting < registered ? "warning" : "positive";

  return (
    <>
      <StatGrid cols={4}>
        <StatCard
          title="Ingest nodes"
          value={registered === null ? reporting : `${reporting} / ${registered}`}
          description={registered === null ? "Reporting host metrics" : "Reporting / registered"}
          tone={nodesTone}
          icon={Server}
        />
        <StatCard title="Active signals" value={activeSignals.length} description="Incoming streams right now" icon={Radio} />
        <StatCard title="Streaming users" value={userCount} description="Distinct users currently live" icon={Users} />
        <StatCard title="Total incoming" value={totalIncoming} description="Sum across active signals" icon={ArrowDownToLine} />
      </StatGrid>
      <IngestNodeTable rows={rows} />
    </>
  );
}
