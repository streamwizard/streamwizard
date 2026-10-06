"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import { formatBandwidth } from "@/lib/utils";
import { useBandwidthUnit } from "@/lib/bandwidth-unit-context";
import type { ObsInstanceSnapshot } from "@repo/metrics";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Enough of a registered node to turn a snapshot's node label back into a link. */
export interface InstanceNodeRef {
  id: string;
  name: string;
}

interface Props {
  rows: ObsInstanceSnapshot[];
  nodes: InstanceNodeRef[];
}

// Influx only knows ids. Eight characters are enough to tell rows apart; the
// instance page has the container name and the owner.
const shortId = (id: string) => (UUID.test(id) ? id.slice(0, 8) : id);

// One row per currently-running OBS instance: which node it's on, whose it
// is, and what it's using. Each row opens the instance page.
export function ObsInstanceTable({ rows, nodes }: Props) {
  const { unit } = useBandwidthUnit();

  // The metrics API swaps a snapshot's node id for the node's name when it
  // knows it, so a row can arrive carrying either.
  const nodeByLabel = new Map<string, InstanceNodeRef>();
  for (const node of nodes) {
    nodeByLabel.set(node.id, node);
    nodeByLabel.set(node.name, node);
  }
  const nodeIdOf = (row: ObsInstanceSnapshot) => nodeByLabel.get(row.nodeId)?.id ?? (UUID.test(row.nodeId) ? row.nodeId : undefined);

  const columns: DataColumn<ObsInstanceSnapshot>[] = [
    {
      key: "instance",
      header: "Instance",
      mobile: "title",
      cell: (row) => <span className="font-mono text-xs">{shortId(row.instanceId)}</span>,
    },
    {
      key: "node",
      header: "Node",
      // A node only Influx knows has no name: its id stands in, shortened like the others.
      cell: (row) => {
        const name = nodeByLabel.get(row.nodeId)?.name ?? row.nodeId;
        return UUID.test(name) ? <span className="font-mono text-xs">{shortId(name)}</span> : name;
      },
    },
    {
      key: "user",
      header: "User",
      cell: (row) =>
        UUID.test(row.userId) ? (
          // Above the row link, so the user page stays one tap away.
          <Link href={`/users/${row.userId}`} className="relative z-10 font-mono text-xs underline decoration-muted-foreground/50 underline-offset-4">
            {shortId(row.userId)}
          </Link>
        ) : (
          <span className="font-mono text-xs">{row.userId}</span>
        ),
    },
    {
      key: "cpu",
      header: "CPU",
      className: "text-right tabular-nums",
      headClassName: "text-right",
      cell: (row) => `${row.cpuPct.toFixed(0)}%`,
    },
    {
      key: "ram",
      header: "RAM",
      className: "text-right tabular-nums",
      headClassName: "text-right",
      cell: (row) => `${row.ramUsedMb.toFixed(0)} / ${row.ramLimitMb.toFixed(0)} MB`,
    },
    {
      key: "vram",
      header: "VRAM",
      className: "text-right tabular-nums",
      headClassName: "text-right",
      cell: (row) => `${row.vramUsedMb.toFixed(0)} MB`,
    },
    {
      key: "bandwidth",
      header: "Bandwidth (in / out)",
      mobile: "hidden",
      className: "hidden text-right text-xs text-muted-foreground tabular-nums @4xl:table-cell",
      headClassName: "hidden text-right @4xl:table-cell",
      cell: (row) => `${formatBandwidth(row.rxBytesPerSec, unit)} / ${formatBandwidth(row.txBytesPerSec, unit)}`,
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 px-4 pb-2 sm:px-6">
        <CardTitle className="text-base">Running instances</CardTitle>
        <span className="text-xs text-muted-foreground tabular-nums">{rows.length} running</span>
      </CardHeader>
      {/* Phone cards run edge to edge; the table keeps the card's padding. */}
      <CardContent className="px-0 sm:px-6">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No instances running</p>
        ) : (
          <DataList
            rows={rows}
            rowKey={(row) => row.instanceId}
            rowHref={(row) => {
              const nodeId = nodeIdOf(row);
              return nodeId ? `/obs/${nodeId}/instances/${row.instanceId}` : undefined;
            }}
            columns={columns}
          />
        )}
      </CardContent>
    </Card>
  );
}
