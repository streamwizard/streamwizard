import Link from "next/link";
import { Archive, CheckCheck, Inbox, Link2Off, MoonStar, SearchX, Ticket } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getDiscordUserIdForUser } from "@repo/supabase/queries/discord";
import { listTicketCategories, listTicketProducts } from "@repo/supabase/queries/ticket-config";
import {
  type DiscordTicket,
  type OpenTicketCounts,
  type TicketListFilters,
  getOpenTicketCounts,
  listTickets,
} from "@repo/supabase/queries/tickets";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
  NativeSelect,
  NativeSelectOption,
} from "@repo/ui";
import { TicketFiltersForm } from "@/components/discord/ticket-filters-form";
import { TicketList } from "@/components/discord/ticket-list";
import { TicketListLive } from "@/components/discord/ticket-list-live";
import { PageTabs } from "@/components/page-tabs";
import { FilterPanel } from "@/components/widgets/filter-panel";
import { PageHeader } from "@/components/widgets/page-header";
import { assertAdmin } from "@/lib/assert-admin";
import { requireDiscordContext } from "@/lib/discord/api";
import { TICKET_CLOSE_CODE_LABELS } from "@/lib/discord/tickets";
import { resolveDiscordProfiles } from "@/lib/discord/users";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

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

// 44px and 16px text on a phone (smaller text makes iOS zoom the page on focus), the usual size from 768px.
const FIELD = "h-11 md:h-9";
const SELECT = "h-11 w-full text-base md:h-9 md:text-sm";

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
      showsClosed(view) && params.closed && params.closed in TICKET_CLOSE_CODE_LABELS
        ? (params.closed as keyof typeof TICKET_CLOSE_CODE_LABELS)
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
          <Button variant="outline" size="sm" className="h-11 md:h-8" asChild>
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
  const adminUserId = await assertAdmin();
  const view: View = isView(params.status) ? params.status : "open";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  // Archived categories and products stay in the filters: closed tickets still use them.
  const [categories, products, counts, adminDiscordId] = await Promise.all([
    listTicketCategories(supabaseAdmin, guildId),
    listTicketProducts(supabaseAdmin, guildId),
    getOpenTicketCounts(supabaseAdmin, guildId),
    getDiscordUserIdForUser(supabaseAdmin, adminUserId),
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
  const activeKeys = FILTER_KEYS.filter((key) => params[key] && !(key === "closed" && !showsClosed(view)));
  const filtered = activeKeys.length > 0;
  // The search box is always in view, so it doesn't count towards what the Filters button hides.
  const panelCount = activeKeys.filter((key) => key !== "q").length;

  // Same rules as the ticket page: the bot claims as the admin's linked Discord
  // account, and a category can switch claiming off.
  const linked = !!adminDiscordId;
  const noClaiming = new Set(categories.filter((c) => c.claiming_enabled === false).map((c) => c.slug));
  const claimable = (ticket: DiscordTicket) =>
    ticket.status === "open" && !ticket.claimed_by_discord_user_id && !noClaiming.has(ticket.category);

  const pageHref = (target: number) => {
    const next = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    next.set("page", String(target));
    return `/discord/tickets?${next}`;
  };

  return (
    <div className="space-y-6">
      {/* New, claimed and closed tickets show up without a reload. */}
      <TicketListLive guildId={guildId} />
      <PageHeader title="Tickets" description={VIEWS[view].description} />

      <PageTabs
        label="Ticket views"
        variant="pills"
        tabs={VIEW_ORDER.map((id) => {
          const countKey = VIEWS[id].count;
          return {
            href: viewHref(id, params),
            label: VIEWS[id].label,
            active: id === view,
            count: countKey ? counts[countKey] : null,
            attention: id !== "open",
          };
        })}
      />

      <TicketFiltersForm className="flex flex-wrap items-center gap-2 [&_[data-slot=native-select-wrapper]]:w-full sm:[&_[data-slot=native-select-wrapper]]:w-auto">
        {view !== "open" && <input type="hidden" name="status" value={view} />}
        <Input
          name="q"
          defaultValue={params.q}
          placeholder="Search subjects"
          aria-label="Search subjects"
          enterKeyHint="search"
          className={`${FIELD} min-w-0 flex-1 sm:min-w-56`}
        />
        <FilterPanel activeCount={panelCount}>
          <NativeSelect name="product" defaultValue={params.product ?? ""} aria-label="Product" className={`${SELECT} sm:w-44`}>
            <NativeSelectOption value="">Any product</NativeSelectOption>
            {products.map((product) => (
              <NativeSelectOption key={product.slug} value={product.slug}>
                {product.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect name="category" defaultValue={params.category ?? ""} aria-label="Category" className={`${SELECT} sm:w-44`}>
            <NativeSelectOption value="">Any category</NativeSelectOption>
            {categories.map((category) => (
              <NativeSelectOption key={category.slug} value={category.slug}>
                {category.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect name="priority" defaultValue={params.priority ?? ""} aria-label="Priority" className={`${SELECT} sm:w-36`}>
            <NativeSelectOption value="">Any priority</NativeSelectOption>
            <NativeSelectOption value="high">High</NativeSelectOption>
            <NativeSelectOption value="medium">Medium</NativeSelectOption>
            <NativeSelectOption value="low">Low</NativeSelectOption>
          </NativeSelect>
          {showsClosed(view) && (
            <NativeSelect name="closed" defaultValue={params.closed ?? ""} aria-label="How it closed" className={`${SELECT} sm:w-44`}>
              <NativeSelectOption value="">Closed any way</NativeSelectOption>
              {Object.entries(TICKET_CLOSE_CODE_LABELS).map(([code, label]) => (
                <NativeSelectOption key={code} value={code}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
          <Input name="opener" defaultValue={params.opener} placeholder="Opened by" aria-label="Opened by" className={`${FIELD} w-full sm:w-44`} />
          <Input name="claimer" defaultValue={params.claimer} placeholder="Claimed by" aria-label="Claimed by" className={`${FIELD} w-full sm:w-44`} />
          <span className="flex w-full items-center gap-2 sm:w-auto">
            <Input name="from" type="date" defaultValue={params.from} aria-label="Opened from" className={`${FIELD} min-w-0 flex-1 sm:w-40 sm:flex-none`} />
            <span className="text-sm text-muted-foreground">to</span>
            <Input name="to" type="date" defaultValue={params.to} aria-label="Opened until" className={`${FIELD} min-w-0 flex-1 sm:w-40 sm:flex-none`} />
          </span>
          <Button type="submit" size="sm" variant="secondary" className="h-11 md:h-8">
            Apply
          </Button>
          {filtered && (
            <Button variant="ghost" size="sm" className="h-11 md:h-8" asChild>
              <Link href={viewHref(view, {})}>Clear filters</Link>
            </Button>
          )}
        </FilterPanel>
      </TicketFiltersForm>

      {!linked && tickets.some(claimable) && (
        <Alert>
          <Link2Off />
          <AlertTitle>Your Discord account isn&apos;t linked</AlertTitle>
          <AlertDescription>
            Link it in StreamWizard and the bot can claim, reply and close as you. Until then you can read tickets here, but not claim them.
          </AlertDescription>
        </Alert>
      )}

      {tickets.length === 0 ? (
        <EmptyList view={view} filtered={filtered} />
      ) : (
        <TicketList
          tickets={tickets}
          categoryNames={categoryNames}
          productLabels={productLabels}
          profiles={Object.fromEntries(profiles)}
          canClaim={linked ? claimable : undefined}
        />
      )}

      {tickets.length > 0 && (
        <nav className="flex flex-wrap items-center justify-between gap-2 text-sm" aria-label="Pagination">
          <span className="text-muted-foreground tabular-nums">
            {total} ticket{total === 1 ? "" : "s"}
            {pages > 1 && ` · page ${page} of ${pages}`}
          </span>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-11 px-4 md:h-8 md:px-3" asChild={page > 1} disabled={page <= 1}>
                {page > 1 ? <Link href={pageHref(page - 1)}>Newer</Link> : <span>Newer</span>}
              </Button>
              <Button variant="outline" size="sm" className="h-11 px-4 md:h-8 md:px-3" asChild={page < pages} disabled={page >= pages}>
                {page < pages ? <Link href={pageHref(page + 1)}>Older</Link> : <span>Older</span>}
              </Button>
            </div>
          )}
        </nav>
      )}
    </div>
  );
}
