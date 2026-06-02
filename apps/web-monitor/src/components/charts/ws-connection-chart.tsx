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
import type { WsConnectionPoint } from "@repo/metrics";

interface Props {
  initialData: WsConnectionPoint[];
  rangeHours?: number;
}

type ChartRow = { time: string; [key: string]: number | string };

function transformData(data: WsConnectionPoint[]): ChartRow[] {
  const map = new Map<string, ChartRow>();

  for (const point of data) {
    if (point.event !== "open") continue;
    const key = point.time;
    const existing: ChartRow = map.get(key) ?? { time: key };
    existing[point.role] = ((existing[point.role] as number | undefined) ?? 0) + point.count;
    map.set(key, existing);
  }

  return Array.from(map.values())
    .sort((a, b) => new Date(a.time as string).getTime() - new Date(b.time as string).getTime())
    .map((d) => ({ ...d, time: formatTime(d.time as string) }));
}

export function WsConnectionChart({ initialData, rangeHours = 24 }: Props) {
  const { interval } = useRefreshInterval();
  const { range } = useTimeRange();
  const { data: raw } = useSWR<{ connections: WsConnectionPoint[] }>(
    `/api/metrics/ws?range=${range.fluxRange}&window=${range.window}`,
    fetcher,
    { fallbackData: { connections: initialData }, refreshInterval: interval }
  );

  const chartData = transformData(raw?.connections ?? initialData);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Connections by Role (opens)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gPublisher" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gSubscriber" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gBot" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Area type="monotone" dataKey="publisher" stroke="var(--chart-1)" fill="url(#gPublisher)" strokeWidth={2} />
            <Area type="monotone" dataKey="subscriber" stroke="var(--chart-2)" fill="url(#gSubscriber)" strokeWidth={2} />
            <Area type="monotone" dataKey="bot" stroke="var(--chart-3)" fill="url(#gBot)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
