"use client";

import useSWR from "swr";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { formatErrorPct } from "@/components/apps/app-format";
import { DataList } from "@/components/widgets/data-list";
import { ENV_LABEL } from "@/lib/apps-model";
import { useRefreshInterval } from "@/lib/refresh-interval-context";
import { useTimeRange } from "@/lib/time-range-context";
import { statusMeaning, type ErrorRow } from "@/lib/traefik-model";
import { fetcher } from "@/lib/utils";
import { ERRORS_TABLE_HINT } from "./traefik-format";

interface Props {
  /** Same endpoint as the page's charts, so one request feeds them all. */
  apiPath: string;
  initialData: ErrorRow[];
  showEnv?: boolean;
}

/** Which app answered with which error code, most frequent first. Follows the header's range. */
export function ErrorCodeTable({ apiPath, initialData, showEnv = false }: Props) {
  const { interval } = useRefreshInterval();
  const { range } = useTimeRange();
  const { data } = useSWR<{ errors: ErrorRow[] }>(`${apiPath}&range=${range.fluxRange}&window=${range.window}`, fetcher, {
    fallbackData: { errors: initialData },
    refreshInterval: interval,
  });
  const rows = data?.errors ?? initialData;

  return (
    <Card>
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-base">Errors by app and code</CardTitle>
        <CardDescription>{ERRORS_TABLE_HINT}</CardDescription>
      </CardHeader>
      {/* Phone cards run edge to edge; the table keeps the card's padding. */}
      <CardContent className="px-0 sm:px-6">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No 4xx or 5xx answers in this range.</p>
        ) : (
          <DataList
            rows={rows}
            rowKey={(row) => row.id}
            columns={[
              {
                key: "code",
                header: "Code",
                mobile: "badge",
                cell: (row) => (
                  <Badge variant="outline" className="font-mono text-xs">
                    {row.code}
                  </Badge>
                ),
              },
              {
                key: "app",
                header: "App",
                mobile: "title",
                cell: (row) => (
                  <>
                    {row.app}
                    {showEnv && <span className="block text-xs font-normal text-muted-foreground">{ENV_LABEL[row.env]}</span>}
                  </>
                ),
              },
              {
                key: "meaning",
                header: "Means",
                className: "text-muted-foreground",
                cell: (row) => statusMeaning(row.code) || "—",
              },
              {
                key: "count",
                header: "Count",
                headClassName: "text-right",
                className: "text-right tabular-nums",
                cell: (row) => row.count.toLocaleString("en-US"),
              },
              {
                key: "share",
                header: "Of the app's answers",
                mobileLabel: "Of its answers",
                headClassName: "text-right",
                className: "text-right tabular-nums",
                cell: (row) => formatErrorPct(row.sharePct),
              },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}
