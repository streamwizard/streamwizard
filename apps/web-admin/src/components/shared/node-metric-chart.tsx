"use client";

import useSWR from "swr";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTime, formatBandwidth, fetcher } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import type { BandwidthUnit } from "@/lib/utils";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { useTimeRange } from "@/lib/time-range-context";
import { useBandwidthUnit } from "@/lib/bandwidth-unit-context";
import {
  AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  ChartCard,
  LEGEND_WRAPPER_STYLE,
  chartColor,
} from "./chart-kit";

// Shared shape for any "one value per node per timestamp" series — host_system
// and obs_node measurements both query down to this, so a single chart
// component covers CPU/RAM/GPU/bandwidth for both ingest and OBS fleets.
export interface NodeMetricPoint {
  time: string;
  nodeId: string;
  value: number;
}

// A function prop can't cross the server/client boundary (pages that render
// this are Server Components), so callers pass a format name instead and the
// actual formatter lives here, client-side.
export type NodeMetricFormat = "percent" | "share" | "bytesPerSec" | "ms" | "number" | "hours" | "bytes" | "decimal" | "perSec" | "latencyMs";

const trim = (value: number) => (Math.abs(value) >= 100 ? value.toFixed(0) : Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2));

function formatValue(
  value: number,
  format: NodeMetricFormat,
  bandwidthUnit: BandwidthUnit,
): string {
  switch (format) {
    case "percent":
      return `${value.toFixed(0)}%`;
    // A share that matters below 1%: an error rate, where 0.4% is not 0%.
    case "share":
      return `${value > 0 && value < 10 ? value.toFixed(1) : value.toFixed(0)}%`;
    case "bytesPerSec":
      return formatBandwidth(value, bandwidthUnit);
    case "ms":
      return `${Math.round(value)} ms`;
    case "hours":
      return `${Math.round(value)} h`;
    case "bytes":
      return formatBytes(value);
    case "decimal":
      return trim(value);
    case "perSec":
      return `${trim(value)}/s`;
    case "latencyMs":
      return `${trim(value)} ms`;
    default:
      return String(value);
  }
}

interface Props {
  title: string;
  initialData: NodeMetricPoint[];
  apiPath: string;
  dataKey: string;
  format?: NodeMetricFormat;
  /** Draw a baseline at y=0. For a signed metric (A/V skew) the sign is the
   * whole point, so the axis needs a visible zero to read against. */
  zeroLine?: boolean;
  /** Show only these series (matched against the point's nodeId, which is the
   * node *name* after labeling — pass both name and raw id to be safe). Used
   * by the single-node detail page on top of the fleet-wide API payload. */
  filterNodeIds?: string[];
  /** Hide series whose id matches this regex source (a string, so a Server
   * Component can pass it). */
  excludePattern?: string;
  /** Pins these series to the first colours, in this order, so a series keeps
   * its colour while another one has no data. Without it colour follows the
   * order the series show up in. */
  seriesOrder?: string[];
}

/** Rates and small shares live below 1: whole-number ticks would flatten them. */
const DECIMAL_AXIS: ReadonlySet<NodeMetricFormat> = new Set(["share", "perSec"]);

type ChartRow = { t: number; [nodeId: string]: number | undefined };

function transformData(
  data: NodeMetricPoint[],
  windowMs: number,
  domainStart: number,
  domainEnd: number,
): { rows: ChartRow[]; nodeIds: string[] } {
  const map = new Map<number, ChartRow>();
  const nodeIds = new Set<string>();

  for (const point of data) {
    nodeIds.add(point.nodeId);
    const t = new Date(point.time).getTime();
    const existing: ChartRow = map.get(t) ?? { t };
    existing[point.nodeId] = point.value;
    map.set(t, existing);
  }

  // Influx omits empty windows (createEmpty: false), so a silent node has no
  // rows at all during an outage — and Recharts happily draws a line straight
  // across a hole with no rows in it. Materialize every window bucket in the
  // visible range; buckets a node never wrote to stay undefined, which is
  // what actually breaks the line (connectNulls is off).
  for (
    let t = Math.ceil(domainStart / windowMs) * windowMs;
    t <= domainEnd;
    t += windowMs
  ) {
    if (!map.has(t)) map.set(t, { t });
  }

  const rows = Array.from(map.values()).sort((a, b) => a.t - b.t);
  return { rows, nodeIds: Array.from(nodeIds) };
}

/** "30m" / "24h" (Flux duration) → milliseconds, for anchoring the X axis. */
function fluxRangeToMs(fluxRange: string): number {
  const match = /^(\d+)([mh])$/.exec(fluxRange);
  if (!match) return 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  return match[2] === "h" ? n * 3_600_000 : n * 60_000;
}

export function NodeMetricChart({
  title,
  initialData,
  apiPath,
  dataKey,
  format = "number",
  zeroLine,
  filterNodeIds,
  excludePattern,
  seriesOrder,
}: Props) {
  const { interval } = useRefreshInterval();
  const { range } = useTimeRange();
  const { unit: bandwidthUnit } = useBandwidthUnit();
  const { data: raw } = useSWR<Record<string, NodeMetricPoint[]>>(
    `${apiPath}${apiPath.includes("?") ? "&" : "?"}range=${range.fluxRange}&window=${range.window}`,
    fetcher,
    { fallbackData: { [dataKey]: initialData }, refreshInterval: interval },
  );

  // Real time axis anchored at "now": offline nodes leave visible empty
  // space on the right instead of their last sample hugging the edge.
  const now = Date.now();
  const domainStart = now - fluxRangeToMs(range.fluxRange);
  let points = raw?.[dataKey] ?? initialData;
  if (filterNodeIds?.length) {
    const allowed = new Set(filterNodeIds);
    points = points.filter((p) => allowed.has(p.nodeId));
  }
  if (excludePattern) {
    const exclude = new RegExp(excludePattern);
    points = points.filter((p) => !exclude.test(p.nodeId));
  }
  const { rows, nodeIds: seen } = transformData(
    points,
    fluxRangeToMs(range.window),
    domainStart,
    now,
  );
  // Pinned series first, each on its own colour slot whether it has data or not.
  const pinned = seriesOrder ?? [];
  const series = [
    ...pinned.flatMap((nodeId, slot) => (seen.includes(nodeId) ? [{ nodeId, slot }] : [])),
    ...seen.filter((nodeId) => !pinned.includes(nodeId)).map((nodeId, i) => ({ nodeId, slot: pinned.length + i })),
  ];

  return (
    <ChartCard title={title} isEmpty={rows.length === 0}>
      <AreaChart data={rows}>
        <defs>
          {series.map(({ nodeId, slot }) => (
            <linearGradient
              key={nodeId}
              id={`g-${dataKey}-${slot}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="5%" stopColor={chartColor(slot)} stopOpacity={0.3} />
              <stop offset="95%" stopColor={chartColor(slot)} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={[domainStart, now]}
          tickFormatter={(t: number) => formatTime(new Date(t).toISOString())}
          tick={AXIS_TICK}
          className="fill-muted-foreground"
        />
        <YAxis
          tick={AXIS_TICK}
          className="fill-muted-foreground"
          tickFormatter={(value: number) =>
            formatValue(value, format, bandwidthUnit)
          }
          allowDecimals={DECIMAL_AXIS.has(format)}
        />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          formatter={(value) =>
            formatValue(Number(value), format, bandwidthUnit)
          }
          labelFormatter={(t) =>
            formatTime(new Date(t as number).toISOString())
          }
        />
        <Legend wrapperStyle={LEGEND_WRAPPER_STYLE} />
        {zeroLine ? <ReferenceLine y={0} strokeDasharray="4 4" className="stroke-muted-foreground" /> : null}
        {series.map(({ nodeId, slot }) => (
          <Area
            key={nodeId}
            type="linear"
            dataKey={nodeId}
            stroke={chartColor(slot)}
            fill={`url(#g-${dataKey}-${slot})`}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ChartCard>
  );
}
