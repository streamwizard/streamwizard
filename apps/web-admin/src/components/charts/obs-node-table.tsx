"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { ObsInstanceSnapshot, ObsNodeSnapshot } from "@repo/metrics";
import type { ObsNode } from "@repo/supabase/queries/obs-nodes";
import { FleetHealth, FleetState, RelativeTime, healthCheckText } from "@/components/admin/fleet-cells";
import { ObsInstanceTable } from "@/components/charts/obs-instance-table";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import { StatCard } from "@/components/widgets/stat-card";
import { StatGrid } from "@/components/widgets/stat-grid";
import { fetcher, formatBandwidth } from "@/lib/utils";
import { formatMb } from "@/lib/format";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { useBandwidthUnit } from "@/lib/bandwidth-unit-context";
import type { FleetNode } from "@/lib/node-fleet";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The registry columns the fleet list shows. Read once with the page; they
 *  only change when someone edits the node. */
export type ObsNodeFacts = Pick<ObsNode, "id" | "name" | "status" | "maintenance" | "api_url" | "gpu_model" | "max_instances">;

/** One node, from up to three sources. Any of them can be missing: the row
 *  still shows, with blanks where that source would have filled in. */
export interface ObsNodeRow {
  key: string;
  /** Registry id. Null when only Influx knows the node, so there is no page to open. */
  id: string | null;
  name: string;
  /** Registry row plus the health probe. Refreshes with the page. */
  fleet: FleetNode | null;
  facts: ObsNodeFacts | null;
  /** Latest Influx reading. Refreshes with the page. */
  snapshot: ObsNodeSnapshot | null;
}

export function mergeObsNodes(fleet: FleetNode[], facts: ObsNodeFacts[], snapshots: ObsNodeSnapshot[]): ObsNodeRow[] {
  const rows = new Map<string, ObsNodeRow>();
  const factsById = new Map(facts.map((node) => [node.id, node]));

  for (const node of fleet) {
    rows.set(node.id, { key: node.id, id: node.id, name: node.name, fleet: node, facts: factsById.get(node.id) ?? null, snapshot: null });
  }
  // The fleet is the polled view of the registry. Fall back to the rows read
  // with the page only when it came back empty (probe or registry trouble),
  // so a node deleted in another tab does not linger here.
  if (fleet.length === 0) {
    for (const node of facts) {
      rows.set(node.id, { key: node.id, id: node.id, name: node.name, fleet: null, facts: node, snapshot: null });
    }
  }

  // The metrics API swaps a snapshot's node id for the node's name when it
  // knows it, so match on both.
  const byName = new Map(Array.from(rows.values(), (row) => [row.name, row]));
  for (const snapshot of snapshots) {
    const row = rows.get(snapshot.nodeId) ?? byName.get(snapshot.nodeId);
    if (row) {
      row.snapshot = snapshot;
    } else {
      rows.set(snapshot.nodeId, {
        key: snapshot.nodeId,
        id: UUID.test(snapshot.nodeId) ? snapshot.nodeId : null,
        name: snapshot.nodeId,
        fleet: null,
        facts: null,
        snapshot,
      });
    }
  }
  return Array.from(rows.values());
}

const DASH = "—";
const pct = (value: number | undefined) => (value === undefined ? DASH : `${value.toFixed(0)}%`);
const mbPair = (used: number, total: number) => `${formatMb(Math.round(used))} / ${formatMb(Math.round(total))}`;

const NUMBER = "text-right tabular-nums";

/** Every OBS node in one list: registry state, health probe and the latest
 *  metrics, where there used to be a table for each. */
export function ObsNodeTable({ rows }: { rows: ObsNodeRow[] }) {
  const { unit } = useBandwidthUnit();

  // The table starts at a 672px list. Extra columns join as the list gets
  // wider (container variants, like DataList itself); the node page has every
  // one of them.
  const columns: DataColumn<ObsNodeRow>[] = [
    {
      key: "node",
      header: "Node",
      mobile: "title",
      className: "max-w-64 whitespace-normal",
      cell: (row) => (
        <>
          <span className="font-medium">{row.name}</span>
          <span className="block font-mono text-xs font-normal break-all text-muted-foreground">
            {row.fleet?.address ?? row.facts?.api_url ?? "no address"}
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
      key: "gpu",
      header: "GPU",
      className: NUMBER,
      headClassName: "text-right",
      cell: (row) => (
        <>
          {pct(row.snapshot?.gpuUtilPct)}
          {row.facts?.gpu_model && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground @2xl:ml-0 @2xl:hidden @4xl:block">{row.facts.gpu_model}</span>
          )}
        </>
      ),
    },
    {
      key: "instances",
      header: "Instances",
      className: NUMBER,
      headClassName: "text-right",
      cell: (row) => {
        const max = row.snapshot?.maxInstances ?? row.facts?.max_instances;
        return `${row.snapshot?.runningInstanceCount ?? DASH} / ${max ?? DASH}`;
      },
    },
    { key: "cpu", header: "CPU", className: NUMBER, headClassName: "text-right", cell: (row) => pct(row.snapshot?.cpuPct) },
    {
      key: "vram",
      header: "VRAM",
      mobile: "hidden",
      className: `hidden @4xl:table-cell ${NUMBER}`,
      headClassName: "hidden text-right @4xl:table-cell",
      cell: (row) => (row.snapshot ? mbPair(row.snapshot.vramUsedMb, row.snapshot.vramTotalMb) : DASH),
    },
    {
      key: "ram",
      header: "RAM",
      mobile: "hidden",
      className: `hidden @5xl:table-cell ${NUMBER}`,
      headClassName: "hidden text-right @5xl:table-cell",
      cell: (row) => (row.snapshot ? mbPair(row.snapshot.ramUsedMb, row.snapshot.ramTotalMb) : DASH),
    },
    {
      key: "encoder",
      header: "Encoder",
      mobile: "hidden",
      className: `hidden @6xl:table-cell ${NUMBER}`,
      headClassName: "hidden text-right @6xl:table-cell",
      cell: (row) =>
        row.snapshot ? (
          <>
            {pct(row.snapshot.encoderUtilPct)}
            <span className="block text-xs text-muted-foreground">
              {row.snapshot.nvencSessions} @ {row.snapshot.nvencAvgFps.toFixed(0)} fps
            </span>
          </>
        ) : (
          DASH
        ),
    },
    {
      key: "power",
      header: "Power",
      mobile: "hidden",
      className: `hidden @7xl:table-cell ${NUMBER}`,
      headClassName: "hidden text-right @7xl:table-cell",
      cell: (row) => (row.snapshot ? `${row.snapshot.powerDrawW.toFixed(0)} W` : DASH),
    },
    {
      key: "bandwidth",
      header: "Bandwidth (in / out)",
      mobile: "hidden",
      className: `hidden text-xs text-muted-foreground @7xl:table-cell ${NUMBER}`,
      headClassName: "hidden text-right @7xl:table-cell",
      cell: (row) =>
        row.snapshot ? `${formatBandwidth(row.snapshot.rxBytesPerSec, unit)} / ${formatBandwidth(row.snapshot.txBytesPerSec, unit)}` : DASH,
    },
    {
      key: "last",
      header: "Last metric",
      mobile: "hidden",
      className: `hidden text-xs text-muted-foreground @6xl:table-cell ${NUMBER}`,
      headClassName: "hidden text-right @6xl:table-cell",
      cell: (row) => <RelativeTime iso={row.fleet?.lastMetricAt ?? row.snapshot?.time} />,
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
          <DataList rows={rows} rowKey={(row) => row.key} rowHref={(row) => (row.id ? `/obs/${row.id}` : undefined)} columns={columns} />
        )}
      </CardContent>
    </Card>
  );
}

export interface ObsFleetData {
  fleet: FleetNode[];
  nodeSnapshot: ObsNodeSnapshot[];
  instanceSnapshot: ObsInstanceSnapshot[];
}

/** The Fleet tab above the charts: stats, the node list and the running
 *  instances. One poll of the metrics API feeds all three, so the numbers on
 *  top move together with the rows under them. */
export function ObsFleetOverview({ initial, facts }: { initial: ObsFleetData; facts: ObsNodeFacts[] }) {
  const { interval } = useRefreshInterval();
  const { data } = useSWR<Partial<ObsFleetData>>("/api/metrics/obs", fetcher, {
    fallbackData: initial,
    refreshInterval: interval,
  });

  const fleet = data?.fleet ?? initial.fleet;
  const nodeSnapshot = data?.nodeSnapshot ?? initial.nodeSnapshot;
  const instanceSnapshot = data?.instanceSnapshot ?? initial.instanceSnapshot;
  const rows = mergeObsNodes(fleet, facts, nodeSnapshot);

  const registered = fleet.length || facts.length;
  const totalRunning = nodeSnapshot.reduce((acc, n) => acc + n.runningInstanceCount, 0);
  const totalCapacity = nodeSnapshot.reduce((acc, n) => acc + n.maxInstances, 0);
  const vramUsedGb = nodeSnapshot.reduce((acc, n) => acc + n.vramUsedMb, 0) / 1024;
  const vramTotalGb = nodeSnapshot.reduce((acc, n) => acc + n.vramTotalMb, 0) / 1024;

  return (
    <>
      <StatGrid cols={4}>
        <StatCard
          title="Nodes"
          value={registered > 0 ? `${nodeSnapshot.length} / ${registered}` : nodeSnapshot.length}
          description={registered > 0 ? "Reporting / registered" : "Reporting host metrics"}
        />
        <StatCard title="Running instances" value={`${totalRunning} / ${totalCapacity}`} description="Across all nodes" />
        <StatCard title="VRAM used" value={`${vramUsedGb.toFixed(1)} GB`} description={`Of ${vramTotalGb.toFixed(0)} GB across nodes`} />
        <StatCard
          title="Utilization"
          value={totalCapacity > 0 ? `${((totalRunning / totalCapacity) * 100).toFixed(0)}%` : DASH}
          description="Instance capacity used"
        />
      </StatGrid>
      <ObsNodeTable rows={rows} />
      <ObsInstanceTable
        rows={instanceSnapshot}
        nodes={rows.flatMap((row) => (row.id ? [{ id: row.id, name: row.name }] : []))}
      />
    </>
  );
}
