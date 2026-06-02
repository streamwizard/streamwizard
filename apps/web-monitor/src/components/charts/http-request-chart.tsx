"use client";

import useSWR from "swr";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetcher, formatTime } from "@/lib/utils";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { useTimeRange } from "@/lib/time-range-context";
import type { HttpRequestPoint } from "@repo/metrics";

interface Props {
  initialData: HttpRequestPoint[];
  rangeHours?: number;
}

function transformData(data: HttpRequestPoint[]) {
  const map = new Map<string, Record<string, number | string>>();

  for (const point of data) {
    const key = point.time;
    const existing = map.get(key) ?? { time: key };
    existing["avg_ms"] = Math.round((Number(existing["avg_ms"] ?? 0) + point.durationMs) / 2);
    existing[`${point.status}`] = (Number(existing[`${point.status}`] ?? 0)) + 1;
    map.set(key, existing);
  }

  return Array.from(map.values())
    .sort((a, b) => new Date(a.time as string).getTime() - new Date(b.time as string).getTime())
    .map((d) => ({ ...d, time: formatTime(d.time as string) }));
}

export function HttpRequestChart({ initialData, rangeHours = 24 }: Props) {
  const { interval } = useRefreshInterval();
  const { range } = useTimeRange();
  const { data: raw } = useSWR<{ requests: HttpRequestPoint[] }>(
    `/api/metrics/http?range=${range.fluxRange}&window=${range.window}`,
    fetcher,
    { fallbackData: { requests: initialData }, refreshInterval: interval }
  );

  const chartData = transformData(raw?.requests ?? initialData);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Avg Response Time (ms)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gAvgMs" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" unit="ms" />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Area
              type="monotone"
              dataKey="avg_ms"
              name="Avg Latency"
              stroke="var(--chart-2)"
              fill="url(#gAvgMs)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
