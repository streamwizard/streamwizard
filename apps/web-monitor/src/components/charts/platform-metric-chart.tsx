"use client";

import useSWR from "swr";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartEmptyState } from "@/components/widgets/chart-empty-state";
import { fetcher, formatTime } from "@/lib/utils";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { useTimeRange } from "@/lib/time-range-context";
import type { PlatformPoint } from "@repo/metrics";

interface Props {
  title: string;
  /** Key into the /api/metrics/supabase response. */
  seriesKey: "cpu" | "memory" | "disk" | "connections" | "cacheHit" | "meanQueryMs" | "queryRate" | "authApiMs";
  initialData: PlatformPoint[];
  unit?: string;
  /** Chart color CSS var index (1-5), maps to --chart-N. */
  color?: number;
  yMax?: number;
}

export function PlatformMetricChart({ title, seriesKey, initialData, unit = "", color = 1, yMax }: Props) {
  const { interval } = useRefreshInterval();
  const { range } = useTimeRange();
  const { data: raw } = useSWR<Record<string, PlatformPoint[]>>(
    `/api/metrics/supabase?range=${range.fluxRange}&window=${range.window}`,
    fetcher,
    { fallbackData: { [seriesKey]: initialData }, refreshInterval: interval },
  );

  const series = raw?.[seriesKey] ?? initialData;
  const chartData = series.map((p) => ({ time: formatTime(p.time), value: p.value }));
  const stroke = `var(--chart-${color})`;
  const gradientId = `gPlatform${seriesKey}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <ChartEmptyState />
        ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={stroke} stopOpacity={0.3} />
                <stop offset="95%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <YAxis
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              domain={yMax !== undefined ? [0, yMax] : undefined}
              tickFormatter={(v: number) => `${Math.round(v)}${unit}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              formatter={(value) => [`${Number(value).toFixed(1)}${unit}`, title]}
            />
            {/* An area series needs 2+ points to draw anything — show dots
                while the series is sparse (young bucket, wide windows). */}
            <Area
              type="monotone"
              dataKey="value"
              stroke={stroke}
              fill={`url(#${gradientId})`}
              strokeWidth={2}
              dot={chartData.length < 10 ? { r: 3, strokeWidth: 0, fill: stroke } : false}
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
