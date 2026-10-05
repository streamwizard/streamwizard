import { ChevronRight } from "lucide-react";
import { Card } from "@repo/ui";
import type { AppRow } from "@/lib/apps-model";
import { AppTable } from "./app-table";

/** Everything on the server that is not ours, folded away at the bottom of /apps. No alerts, no status colours. */
export function OtherApps({ rows }: { rows: AppRow[] }) {
  if (rows.length === 0) return null;
  return (
    <Card className="py-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-0.5 px-4 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
          <span className="font-medium">Other</span>
          <span className="text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "container" : "containers"} of other projects on this server · no alerts
          </span>
        </summary>
        <div className="border-t">
          <AppTable rows={rows} quiet />
        </div>
      </details>
    </Card>
  );
}
