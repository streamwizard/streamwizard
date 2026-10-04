"use client";

import { ArrowDownToLine, ArrowUpFromLine, Radio, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { ActiveIngestSignal } from "@repo/metrics";
import { ActiveSignalsTable } from "@/components/charts/active-signals-table";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import { StatCard } from "@/components/widgets/stat-card";
import { StatGrid } from "@/components/widgets/stat-grid";
import { cn, formatBandwidth } from "@/lib/utils";
import { useBandwidthUnit } from "@/lib/bandwidth-unit-context";
import { useIngestLive } from "@/lib/ingest-live-context";
import type { LiveStatus } from "@/lib/ingest-live-ws";
import type { IngestNodeLive } from "@/lib/monitor-ws";

// The Live tab of the ingest page: fleet and per-node NIC bandwidth plus
// per-stream transport health straight off the ws-server monitor socket
// (shared via IngestLiveProvider, see lib/ingest-live-context.tsx).
// Deliberately network-only: cpu/ram/disk stay on the Fleet tab.

const STATUS_DISPLAY: Record<LiveStatus, { dot: string; label: string }> = {
  connected: { dot: "bg-emerald-500", label: "Connected" },
  connecting: { dot: "bg-amber-500", label: "Connecting" },
  disconnected: { dot: "bg-red-500", label: "Disconnected" },
};

function WsStatusDot({ status }: { status: LiveStatus }) {
  const { dot, label } = STATUS_DISPLAY[status];
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        {status === "connected" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/70 motion-reduce:hidden" />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", dot)} />
      </span>
      <span>Monitor socket</span>
      <span aria-hidden="true">·</span>
      <span className="font-medium text-foreground/80">{label}</span>
    </div>
  );
}

const NUMBER = "text-right tabular-nums";

interface Props {
  /** Latest polled signals, so the streams list has rows before the socket speaks. */
  initialSignals: ActiveIngestSignal[];
  /** Registry names by node id. */
  nodeNames: Record<string, string>;
}

export function IngestLivePanel({ initialSignals, nodeNames }: Props) {
  const { unit } = useBandwidthUnit();
  const { configured, status, nodes, fleet, streams } = useIngestLive();

  const nodeColumns: DataColumn<IngestNodeLive>[] = [
    {
      key: "node",
      header: "Node",
      mobile: "title",
      cell: (n) => nodeNames[n.nodeId] ?? <span className="font-mono text-xs">{n.nodeId}</span>,
    },
    { key: "in", header: "In", className: NUMBER, headClassName: "text-right", cell: (n) => formatBandwidth(n.rxBps, unit) },
    { key: "out", header: "Out", className: NUMBER, headClassName: "text-right", cell: (n) => formatBandwidth(n.txBps, unit) },
    {
      key: "tsIn",
      header: "Tailscale in",
      className: cn(NUMBER, "text-muted-foreground"),
      headClassName: "text-right",
      cell: (n) => formatBandwidth(n.tsRxBps, unit),
    },
    {
      key: "tsOut",
      header: "Tailscale out",
      className: cn(NUMBER, "text-muted-foreground"),
      headClassName: "text-right",
      cell: (n) => formatBandwidth(n.tsTxBps, unit),
    },
  ];

  return (
    <div className="space-y-4">
      {configured ? (
        <>
          <WsStatusDot status={status} />
          <StatGrid cols={4}>
            <StatCard title="Fleet in" value={formatBandwidth(fleet.rxBps, unit)} description="Host NIC receive, all nodes" icon={ArrowDownToLine} />
            <StatCard title="Fleet out" value={formatBandwidth(fleet.txBps, unit)} description="Host NIC transmit, all nodes" icon={ArrowUpFromLine} />
            <StatCard
              title="Nodes reporting"
              value={fleet.nodeCount}
              description="Pushed bandwidth in the last 30s"
              icon={Server}
              tone={fleet.nodeCount === 0 ? "warning" : "positive"}
            />
            <StatCard title="Streams" value={streams.length} description="On the socket in the last 10s" icon={Radio} />
          </StatGrid>
        </>
      ) : (
        <Card>
          <CardContent className="text-sm break-words text-muted-foreground">
            Set <code className="font-mono text-xs break-all">NEXT_PUBLIC_WS_SERVER_URL</code> and{" "}
            <code className="font-mono text-xs break-all">NEXT_PUBLIC_MONITOR_SECRET</code>{" "}
            to turn on the monitor socket. Until then the streams below come from polled metrics only, and node bandwidth is on the
            Fleet tab.
          </CardContent>
        </Card>
      )}

      <ActiveSignalsTable initialData={initialSignals} nodeNames={nodeNames} />

      {configured && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 px-4 pb-2 sm:px-6">
            <CardTitle className="text-base">Node bandwidth</CardTitle>
            <span className="text-xs text-muted-foreground tabular-nums">
              {nodes.length} node{nodes.length === 1 ? "" : "s"}
            </span>
          </CardHeader>
          {/* Phone cards run edge to edge; the table keeps the card's padding. */}
          <CardContent className="px-0 sm:px-6">
            {nodes.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No nodes reporting yet.</p>
            ) : (
              <DataList rows={nodes} rowKey={(n) => n.nodeId} columns={nodeColumns} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
