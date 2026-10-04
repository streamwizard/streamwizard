import Link from "next/link";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getTwitchUsernames, listPlatformEvents, type PlatformEventListFilters } from "@repo/supabase/queries/platform-events";
import {
  PLATFORM_EVENT_GROUPS,
  PLATFORM_EVENT_LABELS,
  PLATFORM_EVENT_STATUS_LABELS,
  PLATFORM_EVENT_STATUSES,
  PLATFORM_EVENT_TYPES,
  isPlatformEventType,
  platformEventTypesInGroup,
  type PlatformEventGroup,
  type PlatformEventStatus,
} from "@repo/types";
import { Button, Card, CardContent, Input, NativeSelect, NativeSelectOption } from "@repo/ui";
import { EventLogList, actorIdsToLookUp } from "@/components/discord/event-log-list";
import { FilterPanel } from "@/components/widgets/filter-panel";
import { PageHeader } from "@/components/widgets/page-header";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Params = { group?: string; type?: string; status?: string; from?: string; to?: string; page?: string };

const isGroup = (value?: string): value is PlatformEventGroup => PLATFORM_EVENT_GROUPS.some((group) => group.id === value);

function parseFilters(params: Params): PlatformEventListFilters {
  return {
    type: params.type && isPlatformEventType(params.type) ? params.type : undefined,
    types: isGroup(params.group) ? platformEventTypesInGroup(params.group) : undefined,
    status: PLATFORM_EVENT_STATUSES.includes(params.status as PlatformEventStatus) ? (params.status as PlatformEventStatus) : undefined,
    from: params.from && DATE.test(params.from) ? `${params.from}T00:00:00.000Z` : undefined,
    to: params.to && DATE.test(params.to) ? `${params.to}T23:59:59.999Z` : undefined,
  };
}

const FILTER_KEYS = ["group", "type", "status", "from", "to"] as const;

export default async function DiscordLogPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { events, total } = await listPlatformEvents(supabaseAdmin, parseFilters(params), page, PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Older rows or actors without a stored name: look them up.
  const actorNames = await getTwitchUsernames(supabaseAdmin, actorIdsToLookUp(events));
  const filtered = Object.entries(params).some(([key, value]) => key !== "page" && value);
  const activeCount = FILTER_KEYS.filter((key) => params[key]).length;

  const pageHref = (target: number) => {
    const next = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    next.set("page", String(target));
    return `/discord/logs?${next}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Event log" description="Platform and Discord server events, including ones the bot skipped." />

      {/* A plain GET form: the filters live in the URL, so a filtered log can be shared and paged. */}
      <form method="get" className="flex flex-wrap items-center gap-2 [&_[data-slot=native-select-wrapper]]:w-full sm:[&_[data-slot=native-select-wrapper]]:w-auto">
        <FilterPanel activeCount={activeCount}>
          <NativeSelect name="group" defaultValue={params.group ?? ""} aria-label="Group" className="h-11 w-full text-base sm:w-44 md:h-9 md:text-sm">
            <NativeSelectOption value="">Any group</NativeSelectOption>
            {PLATFORM_EVENT_GROUPS.map((group) => (
              <NativeSelectOption key={group.id} value={group.id}>
                {group.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect name="type" defaultValue={params.type ?? ""} aria-label="Event type" className="h-11 w-full text-base sm:w-56 md:h-9 md:text-sm">
            <NativeSelectOption value="">Any event</NativeSelectOption>
            {PLATFORM_EVENT_TYPES.map((type) => (
              <NativeSelectOption key={type} value={type}>
                {PLATFORM_EVENT_LABELS[type]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect name="status" defaultValue={params.status ?? ""} aria-label="Delivery" className="h-11 w-full text-base sm:w-40 md:h-9 md:text-sm">
            <NativeSelectOption value="">Any delivery</NativeSelectOption>
            {PLATFORM_EVENT_STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {PLATFORM_EVENT_STATUS_LABELS[status]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <span className="flex w-full items-center gap-2 sm:w-auto">
            <Input name="from" type="date" defaultValue={params.from} aria-label="From" className="h-11 min-w-0 flex-1 sm:w-40 md:h-9" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input name="to" type="date" defaultValue={params.to} aria-label="Until" className="h-11 min-w-0 flex-1 sm:w-40 md:h-9" />
          </span>
          <Button type="submit" size="sm" className="h-11 w-full sm:w-auto md:h-8">
            Filter
          </Button>
        </FilterPanel>
        {filtered && (
          <Button variant="ghost" size="sm" className="h-11 md:h-8" asChild>
            <Link href="/discord/logs">Clear filters</Link>
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {total} event{total === 1 ? "" : "s"}
        </span>
      </form>

      <Card className="py-0 sm:py-2">
        <CardContent className="px-0 sm:px-4">
          {events.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {filtered ? "No events match these filters." : "Nothing logged yet. Sign-ups and Discord links show up here."}
            </p>
          ) : (
            <EventLogList events={events} actorNames={actorNames} />
          )}
        </CardContent>
      </Card>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-2 text-sm" aria-label="Pagination">
          <Button variant="outline" size="sm" className="h-11 md:h-8" asChild={page > 1} disabled={page <= 1}>
            {page > 1 ? <Link href={pageHref(page - 1)}>Newer</Link> : <span>Newer</span>}
          </Button>
          <span className="text-muted-foreground tabular-nums">
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="sm" className="h-11 md:h-8" asChild={page < pages} disabled={page >= pages}>
            {page < pages ? <Link href={pageHref(page + 1)}>Older</Link> : <span>Older</span>}
          </Button>
        </nav>
      )}
    </div>
  );
}
