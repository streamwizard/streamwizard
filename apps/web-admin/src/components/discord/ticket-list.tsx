import { formatTicketNumber, type DiscordTicket } from "@repo/supabase/queries/tickets";
import { Card, CardContent } from "@repo/ui";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import { displayName, type DiscordProfile } from "@/lib/discord/profile-names";
import {
  PRIORITY_LABELS,
  TICKET_CLOSE_CODE_LABELS,
  TICKET_TONE_DOT,
  formatDateTime,
  formatRelativeTime,
  priorityClass,
  ticketState,
} from "@/lib/discord/tickets";
import { cn } from "@/lib/utils";
import { TicketClaimButton } from "./ticket-actions";

type Profiles = Record<string, DiscordProfile>;

// The table drops columns by the width of the list itself (container queries),
// not of the screen: next to the open sidebar a tablet has room for three or
// four, and a table that scrolls sideways hides the Claim button.
const FROM_2XL = "hidden @2xl:table-cell";
const FROM_3XL = "hidden @[44rem]:table-cell";
const FROM_4XL = "hidden @4xl:table-cell";
const FROM_5XL = "hidden @5xl:table-cell";

// Rendered on the server and, in places, on the client: the two clocks differ
// by the request time, so the relative text may shift on hydration.
function When({ iso, prefix }: { iso: string; prefix?: string }) {
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className="whitespace-nowrap tabular-nums" suppressHydrationWarning>
      {prefix ? `${prefix} ` : ""}
      {formatRelativeTime(iso)}
    </time>
  );
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

/**
 * Status and priority for the phone card, stacked. Side by side they take half
 * the card's width and squeeze the subject into a column of single words.
 */
function CardBadges({ ticket }: { ticket: DiscordTicket }) {
  return (
    <span className="flex flex-col items-end gap-0.5 text-sm">
      <StatusCell ticket={ticket} />
      {ticket.priority && (
        <span className={cn("text-xs", priorityClass(ticket.priority))}>{PRIORITY_LABELS[ticket.priority] ?? ticket.priority} priority</span>
      )}
    </span>
  );
}

/** What happened last: the newest message while open, the close afterwards. */
function ActivityCell({ ticket, profiles }: { ticket: DiscordTicket; profiles: Profiles }) {
  if (ticket.status !== "open") {
    const closer = displayName(ticket.closed_by_name, ticket.closed_by_discord_user_id, profiles);
    const cause =
      ticket.close_code && ticket.close_code !== "manual"
        ? TICKET_CLOSE_CODE_LABELS[ticket.close_code as keyof typeof TICKET_CLOSE_CODE_LABELS]
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

interface TicketListProps {
  tickets: DiscordTicket[];
  /** Slug to name. A ticket whose category or product is gone shows the slug. */
  categoryNames: ReadonlyMap<string, string>;
  productLabels: ReadonlyMap<string, string>;
  /** Looked-up Discord profiles for people the ticket row has no name for. */
  profiles: Profiles;
  /** Leave out "Opened by": on a user's page every ticket has the same opener. */
  hideOpener?: boolean;
  /** Which tickets get a Claim button. Leave it out and the list is read-only. */
  canClaim?: (ticket: DiscordTicket) => boolean;
}

/**
 * The one ticket list: a table from 640px up, a card per ticket on a phone.
 * The whole row opens the ticket. Used by the queue and by a user's Tickets tab.
 */
export function TicketList({ tickets, categoryNames, productLabels, profiles, hideOpener = false, canClaim }: TicketListProps) {
  const columns: DataColumn<DiscordTicket>[] = [
    {
      key: "ticket",
      header: "Ticket",
      mobile: "title",
      // Takes the width the other columns leave and cuts the subject to it, instead of pushing them off the edge.
      className: "w-full max-w-0 min-w-48",
      cell: (ticket) => {
        const product = ticket.product ? (productLabels.get(ticket.product) ?? ticket.product) : null;
        const category = categoryNames.get(ticket.category) ?? ticket.category;
        // What a narrow table loses with its Priority and Opened by columns moves under the subject.
        const folded = [
          ticket.priority ? `${PRIORITY_LABELS[ticket.priority] ?? ticket.priority} priority` : null,
          hideOpener ? null : displayName(ticket.opener_name, ticket.opener_discord_user_id, profiles),
        ].filter(Boolean);
        return (
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 font-mono text-xs font-normal text-muted-foreground">{formatTicketNumber(ticket.ticket_number)}</span>
              {/* The card shows the whole subject; the table cuts it short and the ticket page has the rest. */}
              <span className="min-w-0 break-words sm:truncate">{ticket.subject}</span>
            </span>
            <span className="text-xs font-normal text-muted-foreground sm:truncate">
              {[product, category].filter(Boolean).join(" · ")}
              {folded.length > 0 && <span className="hidden sm:inline @4xl:hidden"> · {folded.join(" · ")}</span>}
              <span className="hidden sm:inline @5xl:hidden">
                {" · opened "}
                <When iso={ticket.created_at} />
              </span>
            </span>
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      mobile: "badge",
      cell: (ticket) => (
        <>
          <span className="hidden sm:inline">
            <StatusCell ticket={ticket} />
          </span>
          <span className="sm:hidden">
            <CardBadges ticket={ticket} />
          </span>
        </>
      ),
    },
    // On the card the priority sits under the status badge.
    {
      key: "priority",
      header: "Priority",
      mobile: "hidden",
      className: FROM_4XL,
      headClassName: FROM_4XL,
      cell: (ticket) => <PriorityCell priority={ticket.priority} />,
    },
    ...(hideOpener
      ? []
      : [
          {
            key: "opener",
            header: "Opened by",
            className: `max-w-36 truncate ${FROM_4XL}`,
            headClassName: FROM_4XL,
            cell: (ticket: DiscordTicket) => displayName(ticket.opener_name, ticket.opener_discord_user_id, profiles) ?? "Unknown",
          },
        ]),
    {
      key: "assignee",
      header: "Assigned to",
      className: `max-w-36 truncate ${FROM_2XL}`,
      headClassName: FROM_2XL,
      cell: (ticket) => {
        const assignee = displayName(ticket.claimed_by_name, ticket.claimed_by_discord_user_id, profiles);
        return assignee ?? <span className="text-muted-foreground">{ticket.status === "open" ? "Unclaimed" : "–"}</span>;
      },
    },
    {
      key: "activity",
      header: "Last activity",
      className: FROM_3XL,
      headClassName: FROM_3XL,
      cell: (ticket) => <ActivityCell ticket={ticket} profiles={profiles} />,
    },
    {
      key: "opened",
      header: "Opened",
      // The card already leads with what happened last; with the opener gone there is room for it.
      mobile: hideOpener ? "field" : "hidden",
      className: `text-right text-muted-foreground ${FROM_5XL}`,
      headClassName: `text-right ${FROM_5XL}`,
      cell: (ticket) => <When iso={ticket.created_at} />,
    },
  ];

  const claimable = canClaim ? tickets.some(canClaim) : false;

  return (
    // `isolate`: the list's row actions are raised above the row link, and without it they would also sit above the sticky page header.
    <Card className="@container isolate py-0 sm:py-2">
      <CardContent className="px-0 sm:px-4">
        <DataList
          rows={tickets}
          rowKey={(ticket) => ticket.id}
          rowHref={(ticket) => `/discord/tickets/${ticket.ticket_number}`}
          columns={columns}
          actions={claimable ? (ticket) => (canClaim?.(ticket) ? <TicketClaimButton ticketNumber={ticket.ticket_number} /> : null) : undefined}
        />
      </CardContent>
    </Card>
  );
}
