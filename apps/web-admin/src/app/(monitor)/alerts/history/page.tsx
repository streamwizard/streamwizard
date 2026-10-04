import Link from "next/link";
import { getRuleCatalog } from "@repo/alerting/rules";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listAlertEvents } from "@repo/supabase/queries/alerts";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@repo/ui";
import { TicketFiltersForm } from "@/components/discord/ticket-filters-form";
import { DataList } from "@/components/widgets/data-list";
import { FilterPanel } from "@/components/widgets/filter-panel";
import { PageHeader } from "@/components/widgets/page-header";
import { StatusIndicator, type IndicatorStatus } from "@/components/widgets/status-indicator";
import { homeEnv } from "@/lib/home-env";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const SEVERITIES = ["crit", "warn"] as const;

const EVENT_BADGE_CLASSES: Record<string, string> = {
  fired: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  renotified: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  resolved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  notify_failed: "border-red-500/40 text-red-600 dark:text-red-400",
  silenced: "text-muted-foreground",
};

function severityStatus(severity: string | null): IndicatorStatus {
  return severity === "crit" ? "crit" : severity === "warn" ? "warn" : "muted";
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** One place builds the URL, so paging keeps the filters and filtering drops the cursor. */
function historyHref(params: { severity?: string; rule?: string; before?: string }): string {
  const query = new URLSearchParams();
  if (params.severity) query.set("severity", params.severity);
  if (params.rule) query.set("rule", params.rule);
  if (params.before) query.set("before", params.before);
  const search = query.toString();
  return search ? `/alerts/history?${search}` : "/alerts/history";
}

export default async function AlertHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string; severity?: string; rule?: string }>;
}) {
  const params = await searchParams;
  const before = params.before;
  const severity = SEVERITIES.find((s) => s === params.severity);
  const rule = params.rule?.trim() || undefined;
  const env = homeEnv();

  // Rules grouped the way the Rules tab groups them.
  const catalog = getRuleCatalog();
  const ruleGroups = new Map<string, string[]>();
  for (const entry of catalog) ruleGroups.set(entry.group, [...(ruleGroups.get(entry.group) ?? []), entry.id]);
  // A rule that left the catalog still has history: keep it selectable while it is the filter.
  const unknownRule = rule && !catalog.some((entry) => entry.id === rule) ? rule : null;

  // Fetch one extra row to know whether an older page exists.
  const events = await listAlertEvents(supabaseAdmin, { env, before, severity, ruleId: rule, limit: PAGE_SIZE + 1 });
  const page = events.slice(0, PAGE_SIZE);
  const hasOlder = events.length > PAGE_SIZE;
  const oldest = page.at(-1);
  const activeFilters = (severity ? 1 : 0) + (rule ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Alert history" description={`Every alert event for ${env}, newest first.`}>
        {before && (
          <Button variant="outline" size="sm" className="h-11 md:h-8" asChild>
            <Link href={historyHref({ severity, rule })}>Back to latest</Link>
          </Button>
        )}
      </PageHeader>

      <TicketFiltersForm action="/alerts/history" className="flex flex-wrap items-center gap-2">
        <FilterPanel activeCount={activeFilters}>
          {/* The select's own wrapper is w-fit: stretch it on a phone so a long rule id can't push the page wide.
              Keyed on the value: an uncontrolled select ignores a new defaultValue, and "Clear filters" has to reset it. */}
          <div key={`severity:${severity ?? ""}`} className="w-full sm:w-auto [&>div]:w-full sm:[&>div]:w-fit">
            <NativeSelect name="severity" defaultValue={severity ?? ""} aria-label="Severity" className="h-11 text-base sm:w-40 md:h-9 md:text-sm">
              <NativeSelectOption value="">Any severity</NativeSelectOption>
              <NativeSelectOption value="crit">Crit</NativeSelectOption>
              <NativeSelectOption value="warn">Warn</NativeSelectOption>
            </NativeSelect>
          </div>
          <div key={`rule:${rule ?? ""}`} className="w-full sm:w-auto [&>div]:w-full sm:[&>div]:w-fit">
            <NativeSelect name="rule" defaultValue={rule ?? ""} aria-label="Rule" className="h-11 text-base sm:w-64 md:h-9 md:text-sm">
              <NativeSelectOption value="">Any rule</NativeSelectOption>
              {unknownRule && <NativeSelectOption value={unknownRule}>{unknownRule}</NativeSelectOption>}
              {[...ruleGroups.entries()].map(([group, ids]) => (
                <NativeSelectOptGroup key={group} label={group}>
                  {ids.map((id) => (
                    <NativeSelectOption key={id} value={id}>
                      {id}
                    </NativeSelectOption>
                  ))}
                </NativeSelectOptGroup>
              ))}
            </NativeSelect>
          </div>
        </FilterPanel>
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" className="h-11 md:h-8" asChild>
            <Link href="/alerts/history">Clear filters</Link>
          </Button>
        )}
      </TicketFiltersForm>

      <Card>
        <CardHeader className="px-4 pb-2 sm:px-6">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {before ? `Events before ${formatTimestamp(before)}` : "Most recent events"}
          </CardTitle>
        </CardHeader>
        {/* Phone cards run edge to edge; the table keeps the card's padding. */}
        <CardContent className="px-0 sm:px-6">
          {page.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {activeFilters > 0 ? "No events match these filters." : "No alert events yet."}
            </p>
          ) : (
            <DataList
              rows={page}
              rowKey={(e) => String(e.id)}
              columns={[
                {
                  key: "time",
                  header: "Time",
                  className: "whitespace-nowrap tabular-nums text-muted-foreground",
                  cell: (e) => <span className="tabular-nums">{formatTimestamp(e.created_at)}</span>,
                },
                {
                  key: "event",
                  header: "Event",
                  mobile: "badge",
                  cell: (e) => (
                    <Badge variant="outline" className={cn(EVENT_BADGE_CLASSES[e.event_type])}>
                      {e.event_type.replace(/_/g, " ")}
                    </Badge>
                  ),
                },
                {
                  key: "severity",
                  header: "Severity",
                  cell: (e) => (e.severity ? <StatusIndicator status={severityStatus(e.severity)} label={e.severity} /> : "—"),
                },
                {
                  key: "rule",
                  header: "Rule",
                  mobile: "title",
                  cell: (e) => <span className="font-mono text-xs break-all">{e.rule_id}</span>,
                },
                {
                  key: "entity",
                  header: "Entity",
                  cell: (e) => <span className="font-mono text-xs break-all">{e.entity_id || "—"}</span>,
                },
                {
                  key: "message",
                  header: "Message",
                  // Wraps instead of truncating: the full text has to be readable without a hover.
                  className: "max-w-md whitespace-normal text-muted-foreground",
                  cell: (e) => e.message ?? "—",
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      {hasOlder && oldest && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" className="h-11 w-full sm:w-auto md:h-8" asChild>
            <Link href={historyHref({ severity, rule, before: oldest.created_at })}>Older events</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
