"use client";

import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import type { TicketStatsDay } from "@repo/supabase/queries/ticket-stats";
import { AXIS_TICK, CHART_TOOLTIP_STYLE, chartColor, ChartCard, LEGEND_WRAPPER_STYLE } from "@/components/charts/chart-kit";

const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Opened and closed per day. The rows come from ticket_stats_by_day, one per day of the range. */
export function TicketStatsChart({ days }: { days: TicketStatsDay[] }) {
  const rows = days.map((row) => ({ ...row, label: dayLabel(row.day) }));
  const isEmpty = rows.every((row) => row.opened === 0 && row.closed === 0);

  return (
    <ChartCard title="Opened and closed per day" isEmpty={isEmpty}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tick={AXIS_TICK} minTickGap={24} />
        <YAxis tick={AXIS_TICK} allowDecimals={false} />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
        <Legend wrapperStyle={LEGEND_WRAPPER_STYLE} />
        <Line type="monotone" dataKey="opened" name="Opened" stroke={chartColor(0)} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="closed" name="Closed" stroke={chartColor(1)} strokeWidth={2} dot={false} />
      </LineChart>
    </ChartCard>
  );
}
