import type { UserActivityRow } from "@repo/supabase/queries/admin-users";
import { PLATFORM_EVENT_LABELS } from "@repo/types";
import { Badge } from "@repo/ui";
import { formatDateTime, formatRelativeTime } from "@/lib/discord/tickets";
import { cn } from "@/lib/utils";

const BAD_STATUSES = new Set(["failed", "error"]);

function label(row: UserActivityRow): string {
  if (row.source === "platform") return (PLATFORM_EVENT_LABELS as Record<string, string>)[row.type] ?? row.type;
  return row.type;
}

/** Rows from any activity source, newest first, with the raw payload behind a toggle. */
export function ActivityList({ rows }: { rows: UserActivityRow[] }) {
  return (
    <ol className="divide-y">
      {rows.map((row) => {
        const bad = BAD_STATUSES.has(row.status);
        return (
          <li key={`${row.source}-${row.id}`} className="py-2.5">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 text-sm [&::-webkit-details-marker]:hidden">
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full", bad ? "bg-red-500" : "bg-muted-foreground/40")} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{label(row)}</span>
                  {row.source === "platform" && row.type !== label(row) && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{row.type}</span>
                  )}
                  {row.asActor && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      by this user
                    </Badge>
                  )}
                </span>
                <span className={cn("text-xs", bad ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>{row.status}</span>
                <time dateTime={row.createdAt} title={formatDateTime(row.createdAt)} className="w-20 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                  {formatRelativeTime(row.createdAt)}
                </time>
              </summary>
              <div className="mt-2 space-y-2 pl-5">
                {row.error && <p className="text-xs text-red-600 dark:text-red-400">{row.error}</p>}
                <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(row.detail, null, 2)}</pre>
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
