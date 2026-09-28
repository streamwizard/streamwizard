import Link from "next/link";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listUserTickets } from "@repo/supabase/queries/admin-users";
import { formatTicketNumber } from "@repo/supabase/queries/tickets";
import {
  Card,
  CardContent,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import { PRIORITY_LABELS, formatDateTime, formatRelativeTime, priorityClass } from "@/lib/discord/tickets";
import { loadAdminUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function UserTicketsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await loadAdminUser(id);
  const tickets = await listUserTickets(supabaseAdmin, user.id, user.discord?.userId ?? null);

  if (!tickets.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>No tickets</EmptyTitle>
          <EmptyDescription>
            {user.discord
              ? "Nothing opened from this account or its Discord."
              : "Nothing opened from this account. Tickets opened in Discord before linking only show once Discord is linked."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card className="py-0">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 text-xs text-muted-foreground">Ticket</TableHead>
              <TableHead className="text-xs text-muted-foreground">Status</TableHead>
              <TableHead className="text-xs text-muted-foreground">Priority</TableHead>
              <TableHead className="text-xs text-muted-foreground">Assigned to</TableHead>
              <TableHead className="pr-4 text-right text-xs text-muted-foreground">Opened</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
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
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {[ticket.product, ticket.category].filter(Boolean).join(" · ")}
                  </div>
                </TableCell>
                <TableCell className="py-2.5 text-sm">
                  {ticket.status === "open" ? (
                    "Open"
                  ) : (
                    <span className="text-muted-foreground">
                      Closed{ticket.closed_at ? ` ${formatRelativeTime(ticket.closed_at)}` : ""}
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-2.5 text-sm">
                  {ticket.priority ? (
                    <span className={priorityClass(ticket.priority)}>{PRIORITY_LABELS[ticket.priority] ?? ticket.priority}</span>
                  ) : (
                    <span className="text-muted-foreground/60">–</span>
                  )}
                </TableCell>
                <TableCell className="max-w-44 truncate py-2.5 text-sm">
                  {ticket.claimed_by_name ?? <span className="text-muted-foreground">Unclaimed</span>}
                </TableCell>
                <TableCell className="py-2.5 pr-4 text-right text-sm text-muted-foreground">
                  <time dateTime={ticket.created_at} title={formatDateTime(ticket.created_at)}>
                    {formatRelativeTime(ticket.created_at)}
                  </time>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
