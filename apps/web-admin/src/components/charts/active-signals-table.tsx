"use client";

import Link from "next/link";
import useSWR from "swr";
import { Radio } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { ActiveIngestSignal } from "@repo/metrics";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import { cn, fetcher } from "@/lib/utils";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { useIngestLive } from "@/lib/ingest-live-context";
import type { LiveStreamEntry } from "@/lib/ingest-live-ws";

interface Props {
  initialData: ActiveIngestSignal[];
  /** Registry names by node id, so the Node column is not a uuid. */
  nodeNames: Record<string, string>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The one set of loss thresholds for ingest streams: amber from 0.5%, red from
 * 2%. Loss and retransmit use it, whichever source the number came from. (The
 * socket table used to colour at 1% and 5%; the stricter pair won.) Undefined
 * means the protocol does not report it.
 */
export function lossClass(pct: number | undefined): string {
  if (pct === undefined) return "text-muted-foreground";
  if (pct >= 2) return "text-red-600 dark:text-red-400";
  if (pct >= 0.5) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

/** One incoming stream, from the monitor socket, from InfluxDB, or both. */
export interface IngestStreamRow {
  key: string;
  label: string;
  protocol: string;
  /** Owner id. Only InfluxDB has it; the socket sends a masked room id. */
  userId: string | null;
  maskedRoomId: string | null;
  /** Only the socket says which box the stream landed on. */
  nodeId: string | null;
  kbps: number | undefined;
  rttMs: number | undefined;
  lossPct: number | undefined;
  retransPct: number | undefined;
  /** Receive buffer. Socket only. */
  bufferMs: number | undefined;
  /** "socket": numbers are the 1s reading. "polled": the latest InfluxDB sample. */
  source: "socket" | "polled";
  lastSeen: string | null;
}

/**
 * The socket and InfluxDB describe the same streams with different fields, so
 * they are joined on stream key (session id as a fallback) instead of shown as
 * two tables. Socket numbers win when both have a row: they are a second old,
 * the polled ones up to a refresh interval.
 */
export function mergeIngestStreams(live: LiveStreamEntry[], polled: ActiveIngestSignal[]): IngestStreamRow[] {
  const byStreamKey = new Map(polled.map((signal) => [signal.streamKeyId, signal]));
  const bySession = new Map(polled.map((signal) => [signal.sessionId, signal]));
  const matched = new Set<ActiveIngestSignal>();

  const rows: IngestStreamRow[] = live.map(({ stats, roomId }) => {
    const signal = (stats.stream_key_id ? byStreamKey.get(stats.stream_key_id) : undefined) ?? bySession.get(stats.session_id);
    if (signal) matched.add(signal);
    return {
      key: `socket:${stats.session_id}`,
      label: stats.label ?? signal?.label ?? stats.session_id.slice(0, 8),
      protocol: stats.protocol,
      userId: signal?.userId ?? null,
      maskedRoomId: roomId,
      nodeId: stats.node_id ?? null,
      kbps: stats.kbps ?? signal?.kbps,
      rttMs: stats.rtt_ms ?? signal?.rttMs,
      lossPct: stats.loss_pct ?? signal?.lossPct,
      retransPct: stats.retrans_pct ?? signal?.retransPct,
      bufferMs: stats.ms_rcv_buf,
      source: "socket",
      lastSeen: signal?.lastSeen ?? null,
    };
  });

  for (const signal of polled) {
    if (matched.has(signal)) continue;
    rows.push({
      key: `polled:${signal.streamKeyId}`,
      label: signal.label,
      protocol: signal.protocol,
      userId: signal.userId,
      maskedRoomId: null,
      nodeId: null,
      kbps: signal.kbps,
      rttMs: signal.rttMs,
      lossPct: signal.lossPct,
      retransPct: signal.retransPct,
      bufferMs: undefined,
      source: "polled",
      lastSeen: signal.lastSeen,
    });
  }
  return rows;
}

function num(v: number | undefined, suffix = "", digits = 0): string {
  return v === undefined ? "—" : `${v.toFixed(digits)}${suffix}`;
}

const NUMBER = "text-right tabular-nums";

/** The streams list, already merged. Split out so it renders from plain rows. */
export function IngestStreamList({ rows, nodeNames }: { rows: IngestStreamRow[]; nodeNames: Record<string, string> }) {
  // The table starts at a 672px list; the less urgent columns join as it gets
  // wider. The card layout shows every field but the buffer.
  const columns: DataColumn<IngestStreamRow>[] = [
    { key: "stream", header: "Stream", mobile: "title", cell: (row) => <span className="font-medium break-words">{row.label}</span> },
    {
      key: "protocol",
      header: "Protocol",
      mobile: "badge",
      cell: (row) => (
        <Badge variant="outline" className="font-mono text-[10px] uppercase">
          {row.protocol}
        </Badge>
      ),
    },
    {
      key: "user",
      header: "User",
      cell: (row) =>
        row.userId && UUID.test(row.userId) ? (
          <Link href={`/users/${row.userId}`} className="font-mono text-xs underline decoration-muted-foreground/50 underline-offset-4">
            {row.userId.slice(0, 8)}
          </Link>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">{row.userId ?? row.maskedRoomId ?? "—"}</span>
        ),
    },
    {
      key: "node",
      header: "Node",
      className: "hidden text-muted-foreground @3xl:table-cell",
      headClassName: "hidden @3xl:table-cell",
      cell: (row) =>
        row.nodeId ? (nodeNames[row.nodeId] ?? <span className="font-mono text-xs">{row.nodeId.slice(0, 8)}</span>) : "—",
    },
    { key: "bitrate", header: "Bitrate", className: NUMBER, headClassName: "text-right", cell: (row) => num(row.kbps, " kbps") },
    { key: "rtt", header: "RTT", className: NUMBER, headClassName: "text-right", cell: (row) => num(row.rttMs, " ms", row.source === "socket" ? 1 : 0) },
    {
      key: "loss",
      header: "Loss",
      className: NUMBER,
      headClassName: "text-right",
      cell: (row) => <span className={lossClass(row.lossPct)}>{num(row.lossPct, "%", 2)}</span>,
    },
    {
      key: "retrans",
      header: "Retrans",
      className: cn("hidden @3xl:table-cell", NUMBER),
      headClassName: "hidden text-right @3xl:table-cell",
      cell: (row) => <span className={lossClass(row.retransPct)}>{num(row.retransPct, "%", 2)}</span>,
    },
    {
      key: "buffer",
      header: "Buffer",
      mobile: "hidden",
      className: cn("hidden @5xl:table-cell", NUMBER),
      headClassName: "hidden text-right @5xl:table-cell",
      cell: (row) => num(row.bufferMs, " ms"),
    },
    {
      // Says how fresh the row's numbers are, in words rather than a "live" dot.
      key: "source",
      header: "Updated",
      className: cn("hidden text-xs text-muted-foreground @4xl:table-cell", NUMBER),
      headClassName: "hidden text-right @4xl:table-cell",
      cell: (row) => (
        // The clock time is formatted in the viewer's zone, which the server render cannot know.
        <span suppressHydrationWarning>
          {row.source === "socket" ? "Socket, every second" : row.lastSeen ? `Polled, ${new Date(row.lastSeen).toLocaleTimeString()}` : "Polled"}
        </span>
      ),
    },
  ];

  return <DataList rows={rows} rowKey={(row) => row.key} columns={columns} />;
}

// One row per incoming signal: a user with two cameras (two stream keys) shows
// up as two rows. Fed by the monitor socket where it has the stream, and by
// the polled InfluxDB snapshot for everything else.
export function ActiveSignalsTable({ initialData, nodeNames }: Props) {
  const { interval } = useRefreshInterval();
  const { streams } = useIngestLive();
  const { data: raw } = useSWR<{ activeSignals?: ActiveIngestSignal[] }>("/api/metrics/ingest", fetcher, {
    fallbackData: { activeSignals: initialData },
    refreshInterval: interval,
  });

  const rows = mergeIngestStreams(streams, raw?.activeSignals ?? initialData);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 px-4 pb-2 sm:px-6">
        <CardTitle className="text-base">Streams</CardTitle>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          <Radio className="h-3.5 w-3.5" aria-hidden="true" />
          {rows.length} active
        </span>
      </CardHeader>
      {/* Phone cards run edge to edge; the table keeps the card's padding. */}
      <CardContent className="px-0 sm:px-6">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No active streams</p>
        ) : (
          <IngestStreamList rows={rows} nodeNames={nodeNames} />
        )}
      </CardContent>
    </Card>
  );
}
