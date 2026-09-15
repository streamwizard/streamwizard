import Link from "next/link";
import { Settings } from "lucide-react";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  listTickets,
  TICKET_PRODUCTS,
  ticketProductLabel,
  type DiscordTicketCategory,
  type TicketListFilters,
} from "@repo/supabase/queries/tickets";
import {
  Badge,
  Button,
  Card,
  CardContent,
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
import { AutoRefresh } from "@/components/discord/auto-refresh";
import { PageHeader } from "@/components/widgets/page-header";
import { requireDiscordContext } from "@/lib/discord/api";
import { formatDateTime, TICKET_CATEGORY_LABELS, ticketLabel } from "@/lib/discord/tickets";
import { displayName, resolveDiscordProfiles } from "@/lib/discord/users";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Params = {
  status?: string;
  category?: string;
  product?: string;
  opener?: string;
  claimer?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: string;
};

function parseFilters(params: Params): TicketListFilters {
  return {
    status: params.status === "open" || params.status === "closed" ? params.status : undefined,
    category: params.category && params.category in TICKET_CATEGORY_LABELS ? (params.category as DiscordTicketCategory) : undefined,
    product: TICKET_PRODUCTS.some((p) => p.value === params.product) ? params.product : undefined,
    opener: params.opener?.trim() || undefined,
    claimer: params.claimer?.trim() || undefined,
    search: params.q?.trim() || undefined,
    from: params.from && DATE.test(params.from) ? `${params.from}T00:00:00.000Z` : undefined,
    to: params.to && DATE.test(params.to) ? `${params.to}T23:59:59.999Z` : undefined,
  };
}

export default async function DiscordTicketsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { guildId } = requireDiscordContext();
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { tickets, total } = await listTickets(supabaseAdmin, guildId, parseFilters(params), page, PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const profiles = await resolveDiscordProfiles(
    tickets.flatMap((t) => [t.opener_name ? null : t.opener_discord_user_id, t.claimed_by_name ? null : t.claimed_by_discord_user_id]),
  );
  const filtered = Object.entries(params).some(([key, value]) => key !== "page" && value);

  const pageHref = (target: number) => {
    const next = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    next.set("page", String(target));
    return `/discord/tickets?${next}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Tickets" description="Every support ticket, including closed ones whose channel is gone.">
        {/* New, claimed and closed tickets show up without a reload. */}
        <AutoRefresh wsUrl={process.env.NEXT_PUBLIC_WS_SERVER_URL ?? null} showStatus={false} />
        <Button variant="outline" size="sm" asChild>
          <Link href="/discord/tickets/settings">
            <Settings className="size-4" aria-hidden />
            Settings
          </Link>
        </Button>
      </PageHeader>

      <form method="get" className="space-y-3">
        <div className="flex flex-wrap gap-2 [&_[data-slot=native-select-wrapper]]:w-full sm:[&_[data-slot=native-select-wrapper]]:w-auto">
          <Input name="q" defaultValue={params.q} placeholder="Search subjects" aria-label="Search subjects" className="min-w-56 flex-1" />
          <NativeSelect name="status" defaultValue={params.status ?? ""} aria-label="Status" className="w-full sm:w-36">
            <NativeSelectOption value="">Any status</NativeSelectOption>
            <NativeSelectOption value="open">Open</NativeSelectOption>
            <NativeSelectOption value="closed">Closed</NativeSelectOption>
          </NativeSelect>
          <NativeSelect name="product" defaultValue={params.product ?? ""} aria-label="Product" className="w-full sm:w-48">
            <NativeSelectOption value="">Any product</NativeSelectOption>
            {TICKET_PRODUCTS.map((product) => (
              <NativeSelectOption key={product.value} value={product.value}>
                {product.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect name="category" defaultValue={params.category ?? ""} aria-label="Category" className="w-full sm:w-44">
            <NativeSelectOption value="">Any category</NativeSelectOption>
            {Object.entries(TICKET_CATEGORY_LABELS).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input name="opener" defaultValue={params.opener} placeholder="Opened by (name or Discord id)" aria-label="Opened by" className="w-full sm:w-64" />
          <Input name="claimer" defaultValue={params.claimer} placeholder="Claimed by (name or Discord id)" aria-label="Claimed by" className="w-full sm:w-64" />
          <span className="flex w-full items-center gap-2 sm:w-auto">
            <Input name="from" type="date" defaultValue={params.from} aria-label="Opened from" className="flex-1 sm:w-40" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input name="to" type="date" defaultValue={params.to} aria-label="Opened until" className="flex-1 sm:w-40" />
          </span>
          <Button type="submit" size="sm">
            Filter
          </Button>
          {filtered && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/discord/tickets">Clear filters</Link>
            </Button>
          )}
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">
            {total} ticket{total === 1 ? "" : "s"}
          </span>
        </div>
      </form>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Ticket</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Opened by</TableHead>
                <TableHead>Claimed by</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Closed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id} className="relative">
                  <TableCell className="font-mono text-xs">
                    <Link href={`/discord/tickets/${ticket.ticket_number}`} className="after:absolute after:inset-0">
                      {ticketLabel(ticket.ticket_number)}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-72 truncate font-medium">{ticket.subject}</TableCell>
                  <TableCell className="whitespace-nowrap">{ticketProductLabel(ticket.product) ?? <span className="text-muted-foreground">Not set</span>}</TableCell>
                  <TableCell>{TICKET_CATEGORY_LABELS[ticket.category]}</TableCell>
                  <TableCell>
                    <Badge variant={ticket.status === "open" ? "default" : "outline"}>
                      {ticket.status === "open" ? "Open" : "Closed"}
                    </Badge>
                  </TableCell>
                  <TableCell className="truncate">{displayName(ticket.opener_name, ticket.opener_discord_user_id, profiles)}</TableCell>
                  <TableCell className="truncate text-muted-foreground">
                    {displayName(ticket.claimed_by_name, ticket.claimed_by_discord_user_id, profiles) ?? "Unclaimed"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{formatDateTime(ticket.created_at)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                    {ticket.closed_at ? formatDateTime(ticket.closed_at) : ""}
                  </TableCell>
                </TableRow>
              ))}
              {tickets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="p-8 text-center text-muted-foreground">
                    {filtered ? "No tickets match these filters." : "No tickets yet. Quiet in support, for now."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <Button variant="outline" size="sm" asChild={page > 1} disabled={page <= 1}>
            {page > 1 ? <Link href={pageHref(page - 1)}>Newer</Link> : <span>Newer</span>}
          </Button>
          <span className="text-muted-foreground tabular-nums">
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="sm" asChild={page < pages} disabled={page >= pages}>
            {page < pages ? <Link href={pageHref(page + 1)}>Older</Link> : <span>Older</span>}
          </Button>
        </nav>
      )}
    </div>
  );
}
