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
import { CheckCircle2 } from "lucide-react";
import { fetcher, formatTime } from "@/lib/utils";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { useTimeRange } from "@/lib/time-range-context";
import type { WsMessageDropPoint } from "@repo/metrics";

interface Props {
  initialData: WsMessageDropPoint[];
  rangeHours?: number;
}

const REASON_COLORS: Record<string, string> = {
  room_not_found: "var(--chart-1)",
  malformed_json: "var(--chart-3)",
};

type ChartRow = { time: string; [key: string]: number | string };

function transformData(data: WsMessageDropPoint[]): ChartRow[] {
  const map = new Map<string, ChartRow>();
  for (const point of data) {
    const key = `${point.role}:${point.reason}`;
    const existing: ChartRow = map.get(point.time) ?? { time: point.time };
    existing[key] = ((existing[key] as number | undefined) ?? 0) + point.count;
    map.set(point.time, existing);
  }
  return Array.from(map.values())
    .sort((a, b) => new Date(a.time as string).getTime() - new Date(b.time as string).getTime())
    .map((d) => ({ ...d, time: formatTime(d.time as string) }));
}

export function WsMessageDropChart({ initialData, rangeHours = 24 }: Props) {
  const { interval } = useRefreshInterval();
  const { range } = useTimeRange();
  const { data: raw } = useSWR<{ droppedMessages: WsMessageDropPoint[] }>(
    `/api/metrics/ws?range=${range.fluxRange}&window=${range.window}`,
    fetcher,
    { fallbackData: { droppedMessages: initialData }, refreshInterval: interval }
  );

  const drops = raw?.droppedMessages ?? initialData;
  const chartData = transformData(drops);
  const totalDrops = drops.reduce((acc, d) => acc + d.count, 0);
  const seriesKeys = [...new Set(drops.map((d) => `${d.role}:${d.reason}`))];

  if (totalDrops === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dropped Messages</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 py-8 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">No dropped messages in this time range</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Dropped Messages
          <span className="text-sm font-normal text-destructive">({totalDrops} total)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            {seriesKeys.map((key, i) => {
              const reason = key.split(":")[1] ?? key;
              return (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="a"
                  fill={REASON_COLORS[reason] ?? `var(--chart-${(i % 5) + 1})`}
                />
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
