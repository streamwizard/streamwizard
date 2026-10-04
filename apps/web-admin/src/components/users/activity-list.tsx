import { ChevronDown } from "lucide-react";
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

/** Rows from any activity source, newest first, with the exact time and the raw payload behind a toggle. */
export function ActivityList({ rows }: { rows: UserActivityRow[] }) {
  return (
    // A container: a row goes to two lines when the list itself is narrow, on a phone or in a half-width card.
    <ol className="@container divide-y">
      {rows.map((row) => {
        const bad = BAD_STATUSES.has(row.status);
        const statusClass = bad ? "text-red-600 dark:text-red-400" : "text-muted-foreground";
        return (
          <li key={`${row.source}-${row.id}`}>
            <details className="group">
              {/* The padding is on the summary so the whole row is the tap target. */}
              <summary className="flex cursor-pointer list-none items-start gap-3 py-2.5 text-sm @sm:items-center [&::-webkit-details-marker]:hidden">
                <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full @sm:mt-0", bad ? "bg-red-500" : "bg-muted-foreground/40")} />
                <span className="min-w-0 flex-1">
                  <span className="block @sm:truncate">
                    <span className="font-medium">{label(row)}</span>
                    {row.source === "platform" && row.type !== label(row) && (
                      <span className="ml-2 font-mono text-xs break-all text-muted-foreground">{row.type}</span>
                    )}
                    {row.asActor && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        by this user
                      </Badge>
                    )}
                  </span>
                  {/* In a narrow list the status and time get their own line instead of squeezing the label. */}
                  <span className="mt-0.5 flex gap-2 text-xs @sm:hidden">
                    <span className={statusClass}>{row.status}</span>
                    <span className="text-muted-foreground tabular-nums">{formatRelativeTime(row.createdAt)}</span>
                  </span>
                </span>
                <span className={cn("hidden text-xs @sm:inline", statusClass)}>{row.status}</span>
                <time dateTime={row.createdAt} className="hidden w-20 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums @sm:inline">
                  {formatRelativeTime(row.createdAt)}
                </time>
                <ChevronDown aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 @sm:mt-0" />
              </summary>
              <div className="space-y-2 pb-3 pl-5">
                <p className="text-xs text-muted-foreground">
                  <time dateTime={row.createdAt}>{formatDateTime(row.createdAt)}</time>
                </p>
                {row.error && <p className="text-xs [overflow-wrap:anywhere] text-red-600 dark:text-red-400">{row.error}</p>}
                <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(row.detail, null, 2)}</pre>
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
