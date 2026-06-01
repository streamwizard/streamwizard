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
import type { WsAuthFailurePoint } from "@repo/metrics";

interface Props {
  initialData: WsAuthFailurePoint[];
  rangeHours?: number;
}

const REASONS = ["rate_limited", "invalid_token", "missing_token", "invalid_role", "invalid_bot_key", "upgrade_failed"];
const COLORS: Record<string, string> = {
  rate_limited: "var(--chart-5)",
  invalid_token: "var(--chart-1)",
  missing_token: "var(--chart-3)",
  invalid_role: "var(--chart-4)",
  invalid_bot_key: "var(--chart-2)",
  upgrade_failed: "var(--destructive)",
};

type ChartRow = { time: string; [key: string]: number | string };

function transformData(data: WsAuthFailurePoint[]): ChartRow[] {
  const map = new Map<string, ChartRow>();
  for (const point of data) {
    const existing: ChartRow = map.get(point.time) ?? { time: point.time };
    existing[point.reason] = ((existing[point.reason] as number | undefined) ?? 0) + point.count;
    map.set(point.time, existing);
  }
  return Array.from(map.values())
    .sort((a, b) => new Date(a.time as string).getTime() - new Date(b.time as string).getTime())
    .map((d) => ({ ...d, time: formatTime(d.time as string) }));
}

export function WsAuthFailureChart({ initialData, rangeHours = 24 }: Props) {
  const { interval } = useRefreshInterval();
  const { range } = useTimeRange();
  const { data: raw } = useSWR<{ authFailures: WsAuthFailurePoint[] }>(
    `/api/metrics/ws?range=${range.fluxRange}&window=${range.window}`,
    fetcher,
    { fallbackData: { authFailures: initialData }, refreshInterval: interval }
  );

  const failures = raw?.authFailures ?? initialData;
  const chartData = transformData(failures);
  const totalFailures = failures.reduce((acc, f) => acc + f.count, 0);
  const activeReasons = REASONS.filter((r) => failures.some((f) => f.reason === r));

  if (totalFailures === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auth Failures</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 py-8 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">No auth failures in this time range</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Auth Failures
          <span className="text-sm font-normal text-destructive">({totalFailures} total)</span>
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
            {activeReasons.map((reason) => (
              <Bar key={reason} dataKey={reason} stackId="a" fill={COLORS[reason] ?? "var(--chart-1)"} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
