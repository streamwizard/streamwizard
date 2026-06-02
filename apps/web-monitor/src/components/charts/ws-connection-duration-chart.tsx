"use client";

import useSWR from "swr";
import {
  LineChart,
  Line,
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
import type { WsConnectionDurationPoint } from "@repo/metrics";

interface Props {
  initialData: WsConnectionDurationPoint[];
  rangeHours?: number;
}

type ChartRow = { time: string; [key: string]: number | string };

function transformData(data: WsConnectionDurationPoint[]): ChartRow[] {
  const map = new Map<string, ChartRow>();
  for (const point of data) {
    const existing: ChartRow = map.get(point.time) ?? { time: point.time };
    // Convert ms → seconds for readability
    existing[point.role] = Math.round(point.avgMs / 1000);
    map.set(point.time, existing);
  }
  return Array.from(map.values())
    .sort((a, b) => new Date(a.time as string).getTime() - new Date(b.time as string).getTime())
    .map((d) => ({ ...d, time: formatTime(d.time as string) }));
}

const ROLE_COLORS: Record<string, string> = {
  publisher: "var(--chart-1)",
  subscriber: "var(--chart-2)",
  bot: "var(--chart-3)",
};

export function WsConnectionDurationChart({ initialData, rangeHours = 24 }: Props) {
  const { interval } = useRefreshInterval();
  const { range } = useTimeRange();
  const { data: raw } = useSWR<{ connectionDuration: WsConnectionDurationPoint[] }>(
    `/api/metrics/ws?range=${range.fluxRange}&window=${range.window}`,
    fetcher,
    { fallbackData: { connectionDuration: initialData }, refreshInterval: interval }
  );

  const durations = raw?.connectionDuration ?? initialData;
  const chartData = transformData(durations);
  const roles = [...new Set(durations.map((d) => d.role))];

  if (durations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection Duration</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          No closed connections in this time range
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Avg Connection Duration (seconds)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="s" />
            <Tooltip
              formatter={(value: number) => [`${value}s`, ""]}
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            {roles.map((role) => (
              <Line
                key={role}
                type="monotone"
                dataKey={role}
                stroke={ROLE_COLORS[role] ?? "var(--chart-4)"}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
