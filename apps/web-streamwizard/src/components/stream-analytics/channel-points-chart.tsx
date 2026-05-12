"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { MergedBucket } from "./types";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: MergedBucket = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover p-2 text-xs shadow-md">
      <p className="font-medium">{d.label}</p>
      <p>{d.channelPoints.toLocaleString()} pts</p>
    </div>
  );
}

interface ChannelPointsChartProps {
  data: MergedBucket[];
  xTicks: string[];
  totalPoints: number;
}

export function ChannelPointsChart({ data, xTicks, totalPoints }: ChannelPointsChartProps) {
  if (totalPoints === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Channel points redeemed</CardTitle>
          <span className="text-sm font-semibold text-muted-foreground">
            {formatNumber(totalPoints)} total
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
            <XAxis
              dataKey="label"
              ticks={xTicks}
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatNumber}
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="channelPoints"
              fill="#3b82f6"
              radius={[3, 3, 0, 0]}
              maxBarSize={24}
              name="Points"
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
