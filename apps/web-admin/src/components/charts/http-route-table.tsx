"use client";

import useSWR from "swr";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { DataList } from "@/components/widgets/data-list";
import { fetcher } from "@/lib/utils";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { useTimeRange } from "@/lib/time-range-context";
import type { HttpRouteStatPoint } from "@repo/metrics";

interface Props {
  initialData: HttpRouteStatPoint[];
}

export function HttpRouteTable({ initialData }: Props) {
  const { interval } = useRefreshInterval();
  const { range } = useTimeRange();
  const { data: raw } = useSWR<{ routeStats: HttpRouteStatPoint[] }>(
    `/api/metrics/http?range=${range.fluxRange}&window=${range.window}`,
    fetcher,
    { fallbackData: { routeStats: initialData }, refreshInterval: interval }
  );

  // Busiest first: the query returns the routes in no particular order.
  const rows = [...(raw?.routeStats ?? initialData)].sort((a, b) => b.requestCount - a.requestCount).slice(0, 20);

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-base">Top routes</CardTitle>
      </CardHeader>
      {/* Phone cards run edge to edge; the table keeps the card's padding. */}
      <CardContent className="px-0 sm:px-6">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No requests in this range.</p>
        ) : (
          <DataList
            rows={rows}
            rowKey={(row) => `${row.method} ${row.route}`}
            columns={[
              {
                key: "method",
                header: "Method",
                mobile: "badge",
                cell: (row) => (
                  <Badge variant="outline" className="font-mono text-xs">
                    {row.method}
                  </Badge>
                ),
              },
              {
                key: "route",
                header: "Route",
                mobile: "title",
                // Wraps instead of truncating: the full path has to be readable without a hover.
                className: "whitespace-normal",
                cell: (row) => <span className="font-mono text-xs font-normal break-all">{row.route}</span>,
              },
              {
                key: "requests",
                header: "Requests",
                headClassName: "text-right",
                className: "text-right tabular-nums",
                cell: (row) => <span className="tabular-nums">{row.requestCount.toLocaleString("en-US")}</span>,
              },
              {
                key: "latency",
                header: "Avg latency",
                headClassName: "text-right",
                className: "text-right tabular-nums",
                cell: (row) => <span className="tabular-nums">{Math.round(row.avgDurationMs)}ms</span>,
              },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}
