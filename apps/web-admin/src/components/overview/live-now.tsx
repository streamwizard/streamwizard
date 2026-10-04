import { Card, CardContent } from "@repo/ui";
import { DataList } from "@/components/widgets/data-list";
import type { LiveRow } from "@/lib/overview-data";

/** Who is live right now, most viewers first. Rows open the user when the channel belongs to one. */
export function LiveNow({ rows }: { rows: LiveRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-2 text-center text-sm text-muted-foreground">Nobody is live right now.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="py-0 sm:py-2">
      <CardContent className="px-0 sm:px-4">
        <DataList
          rows={rows}
          rowKey={(row) => row.broadcasterId}
          rowHref={(row) => (row.userId ? `/users/${row.userId}` : undefined)}
          columns={[
            { key: "name", header: "Broadcaster", mobile: "title", className: "font-medium", cell: (row) => row.name },
            {
              key: "viewers",
              header: "Viewers",
              mobile: "badge",
              headClassName: "text-right",
              className: "text-right tabular-nums",
              cell: (row) =>
                row.viewers !== null ? (
                  <span className="tabular-nums">
                    {row.viewers.toLocaleString("en-US")}
                    <span className="sm:hidden"> watching</span>
                  </span>
                ) : (
                  "—"
                ),
            },
            { key: "category", header: "Category", className: "text-muted-foreground", cell: (row) => row.category ?? "—" },
            {
              key: "title",
              header: "Title",
              // Wraps: a stream title is the one thing here you can't guess from the start of it.
              className: "max-w-sm whitespace-normal text-muted-foreground",
              cell: (row) => row.title ?? "—",
            },
            { key: "liveFor", header: "Live for", className: "tabular-nums", cell: (row) => row.liveFor },
          ]}
        />
      </CardContent>
    </Card>
  );
}
