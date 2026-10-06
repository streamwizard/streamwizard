"use client";

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
import type { MultiPoint } from "@repo/metrics";
import { formatTime } from "@/lib/utils";
import type { SupabaseMultiSeriesKey } from "@/lib/supabase-metrics";
import {
  AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  ChartCard,
  LEGEND_WRAPPER_STYLE,
  useMetricsPoll,
} from "./chart-kit";
import type { ChartReference } from "./platform-metric-chart";
import { formatPlatformValue, type PlatformValueFormat } from "./platform-format";

export interface SeriesSpec {
  /** Key inside MultiPoint.values. */
  key: string;
  label: string;
  /** Chart color CSS var index (1-5), maps to --chart-N. */
  color: number;
}

interface Props {
  title: string;
  /** Key into the /api/metrics/supabase response. */
  seriesKey: SupabaseMultiSeriesKey;
  initialData: MultiPoint[];
  series: SeriesSpec[];
  /** Stack the areas (parts of one whole, e.g. busy + iowait CPU) instead of
   * overlaying them. */
  stacked?: boolean;
  unit?: string;
  format?: PlatformValueFormat;
  yMax?: number;
  reference?: ChartReference;
}

/** Several related Supabase series on one chart, with a legend. */
export function PlatformMultiSeriesChart({
  title,
  seriesKey,
  initialData,
  series,
  stacked = false,
  unit = "",
  format = "number",
  yMax,
  reference,
}: Props) {
  const raw = useMetricsPoll<Partial<Record<SupabaseMultiSeriesKey, MultiPoint[]>>>(
    "/api/metrics/supabase",
    { [seriesKey]: initialData },
  );

  const points = raw[seriesKey] ?? initialData;
  const chartData = points.map((p) => ({ time: formatTime(p.time), ...p.values }));
  const sparse = chartData.length < 10;

  return (
    <ChartCard title={title} isEmpty={chartData.length === 0}>
      <AreaChart data={chartData}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`gMulti${seriesKey}${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={`var(--chart-${s.color})`} stopOpacity={stacked ? 0.5 : 0.25} />
              <stop offset="95%" stopColor={`var(--chart-${s.color})`} stopOpacity={stacked ? 0.15 : 0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="time" tick={AXIS_TICK} className="fill-muted-foreground" />
        <YAxis
          tick={AXIS_TICK}
          className="fill-muted-foreground"
          width={format === "bytesPerSec" ? 72 : undefined}
          domain={yMax !== undefined ? [0, yMax] : undefined}
          tickFormatter={(v: number) => formatPlatformValue(v, format, unit, true)}
        />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          formatter={(value, name) => [formatPlatformValue(Number(value), format, unit), name]}
        />
        <Legend wrapperStyle={LEGEND_WRAPPER_STYLE} />
        {reference && (
          <ReferenceLine
            y={reference.value}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
            label={{ value: reference.label, position: "insideTopRight", fontSize: 11, fill: "var(--muted-foreground)" }}
          />
        )}
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stackId={stacked ? "stack" : undefined}
            stroke={`var(--chart-${s.color})`}
            fill={`url(#gMulti${seriesKey}${s.key})`}
            strokeWidth={2}
            dot={sparse ? { r: 3, strokeWidth: 0, fill: `var(--chart-${s.color})` } : false}
          />
        ))}
      </AreaChart>
    </ChartCard>
  );
}
