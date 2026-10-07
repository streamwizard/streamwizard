"use client";

import useSWR from "swr";
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CHART_TOOLTIP_STYLE, ChartCard, LEGEND_WRAPPER_STYLE, rowsByTime } from "@/components/charts/chart-kit";
import type { NodeMetricPoint } from "@/components/charts/node-metric-chart";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { useTimeRange } from "@/lib/time-range-context";
import { fetcher } from "@/lib/utils";

interface Props {
  title: string;
  /** Same endpoint as the page's other charts, so one request feeds them all. */
  apiPath: string;
  initialData: NodeMetricPoint[];
  /** The bands' names, fastest first. */
  initialOrder: string[];
}

// The bands are ordered, so they share one hue in steps (globals.css): the
// slower the band, the heavier the step. Five steps cover Traefik's histogram.
const RAMP_STEPS = 5;
const rampColor = (index: number) => `var(--chart-ramp-${Math.min(index, RAMP_STEPS - 1) + 1})`;

const formatShare = (value: number) => `${value > 0 && value < 10 ? value.toFixed(1) : value.toFixed(0)}%`;

/**
 * How fast the requests were answered: one bar per window, split into speed
 * bands that add up to 100%. A real p95 needs finer steps than the four
 * Traefik's histogram has, so the page shows the steps themselves.
 */
export function SpeedBandChart({ title, apiPath, initialData, initialOrder }: Props) {
  const { interval } = useRefreshInterval();
  const { range } = useTimeRange();
  const { data } = useSWR<{ speedBands: NodeMetricPoint[]; speedBandOrder: string[] }>(`${apiPath}&range=${range.fluxRange}&window=${range.window}`, fetcher, {
    fallbackData: { speedBands: initialData, speedBandOrder: initialOrder },
    refreshInterval: interval,
  });
  const points = data?.speedBands ?? initialData;
  const order = data?.speedBandOrder ?? initialOrder;
  const rows = rowsByTime(points, (row, point) => {
    row[point.nodeId] = point.value;
  });

  return (
    <ChartCard title={title} isEmpty={rows.length === 0}>
      <BarChart data={rows} barCategoryGap="15%">
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
        <XAxis dataKey="time" tick={AXIS_TICK} className="fill-muted-foreground" minTickGap={24} />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AXIS_TICK} className="fill-muted-foreground" tickFormatter={(value: number) => `${value}%`} />
        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: "var(--muted)", opacity: 0.5 }} formatter={(value) => formatShare(Number(value))} />
        {/* Fastest first, as the bars stack, and in text colour: the lightest step is too faint to read as text. */}
        <Legend wrapperStyle={LEGEND_WRAPPER_STYLE} itemSorter={null} formatter={(value) => <span className="text-foreground">{value}</span>} />
        {order.map((band, i) => (
          // The card-coloured stroke is the gap between two bands: no outline of their own.
          <Bar key={band} dataKey={band} stackId="speed" fill={rampColor(i)} stroke="var(--card)" strokeWidth={1} isAnimationActive={false} />
        ))}
      </BarChart>
    </ChartCard>
  );
}
