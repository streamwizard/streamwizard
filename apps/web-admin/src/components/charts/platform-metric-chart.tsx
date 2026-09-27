"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PlatformPoint } from "@repo/metrics";
import { formatTime } from "@/lib/utils";
import {
  AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  ChartCard,
  useMetricsPoll,
} from "./chart-kit";
import { formatPlatformValue, type PlatformValueFormat } from "./platform-format";

export interface ChartReference {
  value: number;
  label: string;
}

interface Props {
  title: string;
  /** Key into the endpoint's response. */
  seriesKey: string;
  /** Route that returns `{ [seriesKey]: PlatformPoint[] }`. */
  endpoint?: string;
  initialData: PlatformPoint[];
  unit?: string;
  format?: PlatformValueFormat;
  /** Chart color CSS var index (1-5), maps to --chart-N. */
  color?: number;
  yMax?: number;
  /** Lower bound of the y axis. The axis still extends below it when the
   * data does, so a drop is never clipped. */
  yMin?: number;
  /** Dashed threshold line, e.g. the alert warn level. */
  reference?: ChartReference;
}

export function PlatformMetricChart({
  title,
  seriesKey,
  endpoint = "/api/metrics/supabase",
  initialData,
  unit = "",
  format = "number",
  color = 1,
  yMax,
  yMin,
  reference,
}: Props) {
  const raw = useMetricsPoll<Record<string, PlatformPoint[]>>(
    endpoint,
    { [seriesKey]: initialData },
  );

  const series = raw[seriesKey] ?? initialData;
  const chartData = series.map((p) => ({
    time: formatTime(p.time),
    value: p.value,
  }));
  const stroke = `var(--chart-${color})`;
  const gradientId = `gPlatform${seriesKey}`;
  const dataMin = chartData.length > 0 ? Math.min(...chartData.map((d) => d.value)) : undefined;
  const lower = yMin === undefined ? 0 : Math.min(yMin, Math.floor(dataMin ?? yMin));
  const domain: [number, number | "auto"] | undefined =
    yMax !== undefined || yMin !== undefined ? [lower, yMax ?? "auto"] : undefined;

  return (
    <ChartCard title={title} isEmpty={chartData.length === 0}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={stroke} stopOpacity={0.3} />
            <stop offset="95%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="time"
          tick={AXIS_TICK}
          className="fill-muted-foreground"
        />
        <YAxis
          tick={AXIS_TICK}
          className="fill-muted-foreground"
          width={format === "bytesPerSec" ? 72 : undefined}
          domain={domain}
          allowDataOverflow={false}
          tickFormatter={(v: number) => formatPlatformValue(v, format, unit, true)}
        />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          formatter={(value) => [formatPlatformValue(Number(value), format, unit), title]}
        />
        {reference && (
          <ReferenceLine
            y={reference.value}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
            label={{ value: reference.label, position: "insideTopRight", fontSize: 11, fill: "var(--muted-foreground)" }}
          />
        )}
        {/* An area series needs 2+ points to draw anything — show dots
            while the series is sparse (young bucket, wide windows). */}
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          fill={`url(#${gradientId})`}
          strokeWidth={2}
          dot={
            chartData.length < 10
              ? { r: 3, strokeWidth: 0, fill: stroke }
              : false
          }
        />
      </AreaChart>
    </ChartCard>
  );
}
