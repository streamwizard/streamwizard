"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { MergedBucket } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: MergedBucket = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover p-2 text-xs shadow-md">
      <p className="font-medium">{d.label}</p>
      <p>
        {d.clipCount} clip{d.clipCount !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

interface ClipActivityChartProps {
  data: MergedBucket[];
  xTicks: string[];
}

export function ClipActivityChart({ data, xTicks }: ClipActivityChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Clip activity</CardTitle>
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
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={24}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="clipCount" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={24} animationDuration={1000} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
