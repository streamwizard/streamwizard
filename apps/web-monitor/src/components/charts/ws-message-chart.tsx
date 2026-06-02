"use client";

import useSWR from "swr";
import {
  BarChart,
  Bar,
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
import type { WsMessagePoint } from "@repo/metrics";

interface Props {
  initialData: WsMessagePoint[];
  rangeHours?: number;
}

type ChartRow = { time: string; [key: string]: number | string };

function transformData(data: WsMessagePoint[]): ChartRow[] {
  const map = new Map<string, ChartRow>();

  for (const point of data) {
    const key = point.time;
    const existing: ChartRow = map.get(key) ?? { time: key };
    const seriesKey = `${point.role}:${point.messageType}`;
    existing[seriesKey] = ((existing[seriesKey] as number | undefined) ?? 0) + point.count;
    map.set(key, existing);
  }

  return Array.from(map.values())
    .sort((a, b) => new Date(a.time as string).getTime() - new Date(b.time as string).getTime())
    .map((d) => ({ ...d, time: formatTime(d.time as string) }));
}

function getUniqueKeys(data: WsMessagePoint[]): string[] {
  const keys = new Set<string>();
  for (const point of data) {
    keys.add(`${point.role}:${point.messageType}`);
  }
  return Array.from(keys);
}

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function WsMessageChart({ initialData, rangeHours = 24 }: Props) {
  const { interval } = useRefreshInterval();
  const { range } = useTimeRange();
  const { data: raw } = useSWR<{ messages: WsMessagePoint[] }>(
    `/api/metrics/ws?range=${range.fluxRange}&window=${range.window}`,
    fetcher,
    { fallbackData: { messages: initialData }, refreshInterval: interval }
  );

  const messages = raw?.messages ?? initialData;
  const chartData = transformData(messages);
  const seriesKeys = getUniqueKeys(messages);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Messages by Role & Type</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData}>
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
            {seriesKeys.map((key, i) => (
              <Bar key={key} dataKey={key} stackId="a" fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
