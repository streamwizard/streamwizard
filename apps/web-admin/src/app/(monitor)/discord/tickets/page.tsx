import Link from "next/link";
import { Archive, BarChart3, CheckCheck, Inbox, MoonStar, SearchX, Settings, SlidersHorizontal, Ticket } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listTicketCategories, listTicketProducts } from "@repo/supabase/queries/ticket-config";
import {
  type DiscordTicket,
  type OpenTicketCounts,
  type TicketListFilters,
  formatTicketNumber,
  getOpenTicketCounts,
  listTickets,
} from "@repo/supabase/queries/tickets";
import {
  Button,
  Card,
  CardContent,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
  NativeSelect,
  NativeSelectOption,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import { TicketFiltersForm } from "@/components/discord/ticket-filters-form";
import { TicketListLive } from "@/components/discord/ticket-list-live";
import { PageHeader } from "@/components/widgets/page-header";
import { requireDiscordContext } from "@/lib/discord/api";
import {
  PRIORITY_LABELS,
  TICKET_TONE_DOT,
  formatDateTime,
  formatRelativeTime,
  priorityClass,
  ticketState,
} from "@/lib/discord/tickets";
import { displayName, resolveDiscordProfiles, type DiscordProfile } from "@/lib/discord/users";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const CLOSE_CODE_LABELS = {
  manual: "Closed by staff",
  inactivity: "Went quiet",
  member_left: "Opener left",
  channel_deleted: "Channel deleted",
  force: "Force closed",
} as const;

// The views are the `status` search param; a missing one is the open queue,
// which is what staff come here for. Filters apply within a view.
const VIEWS = {
  open: {
    label: "Open",
    description: "Everything still open, newest first.",
    filters: { status: "open" },
    count: "open",
  },
  needs_reply: {
    label: "Needs reply",
    description: "Open tickets where the opener wrote last. Someone is waiting.",
    filters: { awaitingStaff: true },
    count: "awaitingStaff",
  },
  stale: {
    label: "Quiet",
    description: "Open tickets that got the reminder and nobody answered since.",
    filters: { stale: true },
    count: "stale",
  },
  closed: {
    label: "Closed",
    description: "Closed tickets, including ones whose channel is gone.",
    filters: { status: "closed" },
    count: null,
  },
  all: {
    label: "All",
    description: "Every ticket, open or closed.",
    filters: {},
    count: null,
  },
} satisfies Record<string, { label: string; description: string; filters: TicketListFilters; count: keyof OpenTicketCounts | null }>;

type View = keyof typeof VIEWS;
const VIEW_ORDER: View[] = ["open", "needs_reply", "stale", "closed", "all"];
const isView = (value: string | undefined): value is View => !!value && value in VIEWS;
/** Views that can show closed tickets, where "how it closed" means something. */
const showsClosed = (view: View) => view === "closed" || view === "all";

type Params = {
  status?: string;
  category?: string;
  product?: string;
  priority?: string;
  closed?: string;
  opener?: string;
  claimer?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: string;
};

const FILTER_KEYS = ["q", "product", "category", "priority", "closed", "opener", "claimer", "from", "to"] as const;
/** Filters that live behind "More filters": open that section when any is set. */
const MORE_KEYS = ["opener", "claimer", "from", "to"] as const;

/** `slugs` are the guild's categories and products: a filter value outside them is ignored. */
function parseFilters(
  view: View,
  params: Params,
  slugs: { categories: Set<string>; products: Set<string> },
): TicketListFilters {
  return {
    ...VIEWS[view].filters,
    category: params.category && slugs.categories.has(params.category) ? params.category : undefined,
    product: params.product && slugs.products.has(params.product) ? params.product : undefined,
    opener: params.opener?.trim() || undefined,
    claimer: params.claimer?.trim() || undefined,
    priority: params.priority === "low" || params.priority === "medium" || params.priority === "high" ? params.priority : undefined,
    closeCode:
      showsClosed(view) && params.closed && params.closed in CLOSE_CODE_LABELS
        ? (params.closed as keyof typeof CLOSE_CODE_LABELS)
        : undefined,
    search: params.q?.trim() || undefined,
    from: params.from && DATE.test(params.from) ? `${params.from}T00:00:00.000Z` : undefined,
    to: params.to && DATE.test(params.to) ? `${params.to}T23:59:59.999Z` : undefined,
  };
}

/** The list URL for a view, keeping the filters that still apply there. Page resets. */
function viewHref(view: View, params: Params): string {
  const next = new URLSearchParams();
  if (view !== "open") next.set("status", view);
  for (const key of FILTER_KEYS) {
    if (key === "closed" && !showsClosed(view)) continue;
    if (params[key]) next.set(key, params[key]);
  }
  const query = next.toString();
  return query ? `/discord/tickets?${query}` : "/discord/tickets";
}

function StatusCell({ ticket }: { ticket: DiscordTicket }) {
  const state = ticketState(ticket);
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap" title={state.hint}>
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", TICKET_TONE_DOT[state.tone])} />
      <span className={state.tone === "closed" ? "text-muted-foreground" : undefined}>{state.label}</span>
    </span>
  );
}

function PriorityCell({ priority }: { priority: string | null }) {
  if (!priority) return <span className="text-muted-foreground/60">–</span>;
  return <span className={priorityClass(priority)}>{PRIORITY_LABELS[priority] ?? priority}</span>;
}

function When({ iso, prefix }: { iso: string; prefix?: string }) {
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className="whitespace-nowrap tabular-nums">
      {prefix ? `${prefix} ` : ""}
      {formatRelativeTime(iso)}
    </time>
  );
}

/** What happened last: the newest message while open, the close afterwards. */
function ActivityCell({ ticket, profiles }: { ticket: DiscordTicket; profiles: Map<string, DiscordProfile> }) {
  if (ticket.status !== "open") {
    const closer = displayName(ticket.closed_by_name, ticket.closed_by_discord_user_id, profiles);
    const cause =
      ticket.close_code && ticket.close_code !== "manual"
        ? CLOSE_CODE_LABELS[ticket.close_code as keyof typeof CLOSE_CODE_LABELS]
        : closer
          ? `by ${closer}`
          : null;
    return (
      <div className="space-y-0.5">
        <div>{ticket.closed_at ? <When iso={ticket.closed_at} prefix="Closed" /> : "Closed"}</div>
        {cause && <div className="truncate text-xs text-muted-foreground">{cause}</div>}
      </div>
    );
  }
  if (!ticket.last_message_at) return <span className="text-muted-foreground">No messages yet</span>;
  return (
    <div className="space-y-0.5">
      <div>{ticket.last_message_by_staff ? "Staff replied" : "Opener wrote"}</div>
      <div className="text-xs text-muted-foreground">
        <When iso={ticket.last_message_at} />
      </div>
    </div>
  );
}

const EMPTY: Record<View, { icon: LucideIcon; title: string; description: string }> = {
  open: { icon: Inbox, title: "Nothing open", description: "Every ticket is closed. Enjoy the quiet while it lasts." },
  needs_reply: { icon: CheckCheck, title: "Everyone has a reply", description: "No opener is waiting on staff right now." },
  stale: { icon: MoonStar, title: "Nothing has gone quiet", description: "Every open ticket has had a message inside the reminder window." },
  closed: { icon: Archive, title: "No closed tickets yet", description: "Closed tickets and their transcripts land here." },
  all: { icon: Ticket, title: "No tickets yet", description: "Quiet in support, for now." },
};

function EmptyList({ view, filtered }: { view: View; filtered: boolean }) {
  const state = filtered
    ? { icon: SearchX, title: "No tickets match", description: "Loosen a filter or clear them all." }
    : EMPTY[view];
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <state.icon />
        </EmptyMedia>
        <EmptyTitle>{state.title}</EmptyTitle>
        <EmptyDescription>{state.description}</EmptyDescription>
      </EmptyHeader>
      {filtered && (
        <EmptyContent>
          <Button variant="outline" size="sm" asChild>
            <Link href={viewHref(view, {})}>Clear filters</Link>
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

export default async function DiscordTicketsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { guildId } = requireDiscordContext();
  const view: View = isView(params.status) ? params.status : "open";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  // Archived categories and products stay in the filters: closed tickets still use them.
  const [categories, products, counts] = await Promise.all([
    listTicketCategories(supabaseAdmin, guildId),
    listTicketProducts(supabaseAdmin, guildId),
    getOpenTicketCounts(supabaseAdmin, guildId),
  ]);
  const categoryNames = new Map(categories.map((c) => [c.slug, c.name]));
  const productLabels = new Map(products.map((p) => [p.slug, p.label]));
  const filters = parseFilters(view, params, {
    categories: new Set(categoryNames.keys()),
    products: new Set(productLabels.keys()),
  });
  const { tickets, total } = await listTickets(supabaseAdmin, guildId, filters, page, PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const profiles = await resolveDiscordProfiles(
    tickets.flatMap((t) => [
      t.opener_name ? null : t.opener_discord_user_id,
      t.claimed_by_name ? null : t.claimed_by_discord_user_id,
      t.closed_by_name ? null : t.closed_by_discord_user_id,
    ]),
  );
  const filtered = FILTER_KEYS.some((key) => params[key] && !(key === "closed" && !showsClosed(view)));
  const moreOpen = MORE_KEYS.some((key) => params[key]);

  const pageHref = (target: number) => {
    const next = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    next.set("page", String(target));
    return `/discord/tickets?${next}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Tickets" description={VIEWS[view].description}>
        {/* New, claimed and closed tickets show up without a reload. */}
        <TicketListLive guildId={guildId} />
        <Button variant="outline" size="sm" asChild>
          <Link href="/discord/tickets/stats">
            <BarChart3 className="size-4" aria-hidden />
            Stats
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/discord/tickets/settings">
            <Settings className="size-4" aria-hidden />
            Settings
          </Link>
        </Button>
      </PageHeader>

      <nav aria-label="Ticket views" className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-lg bg-muted p-[3px]">
        {VIEW_ORDER.map((id) => {
          const active = id === view;
          const countKey = VIEWS[id].count;
          const count = countKey ? counts[countKey] : null;
          return (
            <Link
              key={id}
              href={viewHref(id, params)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-colors",
                "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                active
                  ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {VIEWS[id].label}
              {count !== null && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    count > 0 && id !== "open" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <TicketFiltersForm className="space-y-2 [&_[data-slot=native-select-wrapper]]:w-full sm:[&_[data-slot=native-select-wrapper]]:w-auto">
        {view !== "open" && <input type="hidden" name="status" value={view} />}
        <div className="flex flex-wrap items-center gap-2">
          <Input name="q" defaultValue={params.q} placeholder="Search subjects" aria-label="Search subjects" className="min-w-56 flex-1" />
          <NativeSelect name="product" defaultValue={params.product ?? ""} aria-label="Product" className="w-full sm:w-44">
            <NativeSelectOption value="">Any product</NativeSelectOption>
            {products.map((product) => (
              <NativeSelectOption key={product.slug} value={product.slug}>
                {product.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect name="category" defaultValue={params.category ?? ""} aria-label="Category" className="w-full sm:w-44">
            <NativeSelectOption value="">Any category</NativeSelectOption>
            {categories.map((category) => (
              <NativeSelectOption key={category.slug} value={category.slug}>
                {category.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect name="priority" defaultValue={params.priority ?? ""} aria-label="Priority" className="w-full sm:w-36">
            <NativeSelectOption value="">Any priority</NativeSelectOption>
            <NativeSelectOption value="high">High</NativeSelectOption>
            <NativeSelectOption value="medium">Medium</NativeSelectOption>
            <NativeSelectOption value="low">Low</NativeSelectOption>
          </NativeSelect>
          {showsClosed(view) && (
            <NativeSelect name="closed" defaultValue={params.closed ?? ""} aria-label="How it closed" className="w-full sm:w-44">
              <NativeSelectOption value="">Closed any way</NativeSelectOption>
              {Object.entries(CLOSE_CODE_LABELS).map(([code, label]) => (
                <NativeSelectOption key={code} value={code}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
          <Button type="submit" size="sm" variant="secondary">
            Apply
          </Button>
          {filtered && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={viewHref(view, {})}>Clear filters</Link>
            </Button>
          )}
        </div>

        <details open={moreOpen} className="group">
          <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal className="size-3.5" aria-hidden />
            More filters
          </summary>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input name="opener" defaultValue={params.opener} placeholder="Opened by" aria-label="Opened by" className="w-full sm:w-56" />
            <Input name="claimer" defaultValue={params.claimer} placeholder="Claimed by" aria-label="Claimed by" className="w-full sm:w-56" />
            <span className="flex w-full items-center gap-2 sm:w-auto">
              <Input name="from" type="date" defaultValue={params.from} aria-label="Opened from" className="flex-1 sm:w-40" />
              <span className="text-sm text-muted-foreground">to</span>
              <Input name="to" type="date" defaultValue={params.to} aria-label="Opened until" className="flex-1 sm:w-40" />
            </span>
          </div>
        </details>
      </TicketFiltersForm>

      {tickets.length === 0 ? (
        <EmptyList view={view} filtered={filtered} />
      ) : (
        <Card className="py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4 text-xs text-muted-foreground">Ticket</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Priority</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Opened by</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Assigned to</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Activity</TableHead>
                  <TableHead className="pr-4 text-right text-xs text-muted-foreground">Opened</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => {
                  const product = ticket.product ? (productLabels.get(ticket.product) ?? ticket.product) : null;
                  const category = categoryNames.get(ticket.category) ?? ticket.category;
                  const assignee = displayName(ticket.claimed_by_name, ticket.claimed_by_discord_user_id, profiles);
                  return (
                    <TableRow key={ticket.id} className="relative has-[a:focus-visible]:bg-muted/50">
                      <TableCell className="max-w-96 py-2.5 pl-4">
                        <div className="flex items-baseline gap-2">
                          <Link
                            href={`/discord/tickets/${ticket.ticket_number}`}
                            aria-label={`${formatTicketNumber(ticket.ticket_number)} ${ticket.subject}`}
                            className="shrink-0 font-mono text-xs text-muted-foreground after:absolute after:inset-0 focus-visible:outline-none"
                          >
                            {formatTicketNumber(ticket.ticket_number)}
                          </Link>
                          <span className="min-w-0 truncate font-medium" title={ticket.subject}>
                            {ticket.subject}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{[product, category].filter(Boolean).join(" · ")}</div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <StatusCell ticket={ticket} />
                      </TableCell>
                      <TableCell className="py-2.5">
                        <PriorityCell priority={ticket.priority} />
                      </TableCell>
                      <TableCell className="max-w-44 truncate py-2.5">
                        {displayName(ticket.opener_name, ticket.opener_discord_user_id, profiles)}
                      </TableCell>
                      <TableCell className={cn("max-w-44 truncate py-2.5", !assignee && "text-muted-foreground")}>
                        {assignee ?? (ticket.status === "open" ? "Unclaimed" : "–")}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <ActivityCell ticket={ticket} profiles={profiles} />
                      </TableCell>
                      <TableCell className="py-2.5 pr-4 text-right text-muted-foreground">
                        <When iso={ticket.created_at} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tickets.length > 0 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground tabular-nums">
            {total} ticket{total === 1 ? "" : "s"}
            {pages > 1 && ` · page ${page} of ${pages}`}
          </span>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild={page > 1} disabled={page <= 1}>
                {page > 1 ? <Link href={pageHref(page - 1)}>Newer</Link> : <span>Newer</span>}
              </Button>
              <Button variant="outline" size="sm" asChild={page < pages} disabled={page >= pages}>
                {page < pages ? <Link href={pageHref(page + 1)}>Older</Link> : <span>Older</span>}
              </Button>
            </div>
          )}
        </nav>
      )}
    </div>
  );
}
