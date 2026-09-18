"use client";

import type { DiscordTicket, DiscordTicketEvent } from "@repo/supabase/queries/tickets";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { displayName, type DiscordProfile } from "@/lib/discord/profile-names";
import { formatDateTime } from "@/lib/discord/tickets";

const EVENT_LABELS: Record<string, string> = {
  opened: "Opened",
  claimed: "Claimed",
  unclaimed: "Released",
  closed: "Closed",
  member_added: "Added",
  member_removed: "Removed",
  moved: "Moved",
  transferred: "Handed to",
  priority_changed: "Priority changed",
  renamed: "Subject changed",
  stale_warned: "Reminded: gone quiet",
  close_requested: "Asked to close",
  close_request_accepted: "Close request accepted",
  close_request_rejected: "Kept open",
  close_request_expired: "Close request expired",
  feedback_submitted: "Rated by the opener",
  tag_replied: "Tag auto-replied",
};

/** "Bug → Feature" for timeline entries that carry an old and a new value. Close codes and the like stay out. */
function eventChange(detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null;
  const { from, to, rating, tag } = detail as { from?: unknown; to?: unknown; rating?: unknown; tag?: unknown };
  if (typeof rating === "number") return `${rating}/5`;
  if (typeof tag === "string") return `/tag ${tag}`;
  if (typeof from !== "string" && typeof to !== "string") return null;
  return `${typeof from === "string" ? from : "none"} → ${typeof to === "string" ? to : "none"}`;
}

type TimelineEntry = Pick<DiscordTicketEvent, "id" | "type" | "actor_name" | "created_at"> &
  Partial<Pick<DiscordTicketEvent, "target_name" | "detail">>;

export function TicketTimeline({
  ticket,
  events,
  profiles,
}: {
  ticket: DiscordTicket;
  events: DiscordTicketEvent[];
  profiles: Record<string, DiscordProfile>;
}) {
  const timeline: TimelineEntry[] = events.length
    ? events
    : // Tickets from before the timeline existed: rebuild what the row knows.
      [
        {
          id: "opened",
          type: "opened",
          actor_name: displayName(ticket.opener_name, ticket.opener_discord_user_id, profiles),
          created_at: ticket.created_at,
        },
        ...(ticket.claimed_at
          ? [
              {
                id: "claimed",
                type: "claimed",
                actor_name: displayName(ticket.claimed_by_name, ticket.claimed_by_discord_user_id, profiles),
                created_at: ticket.claimed_at,
              },
            ]
          : []),
        ...(ticket.closed_at
          ? [
              {
                id: "closed",
                type: "closed",
                actor_name: displayName(ticket.closed_by_name, ticket.closed_by_discord_user_id, profiles),
                created_at: ticket.closed_at,
              },
            ]
          : []),
      ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3 border-l pl-4">
          {timeline.map((event) => (
            <li key={event.id} className="relative text-sm">
              <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-foreground/60" aria-hidden />
              <p>
                <span className="font-medium">{EVENT_LABELS[event.type] ?? event.type}</span>
                {event.target_name && <span>: {event.target_name}</span>}
                {event.actor_name && <span className="text-muted-foreground"> by {event.actor_name}</span>}
              </p>
              {eventChange(event.detail) && (
                <p className="text-xs text-muted-foreground">{eventChange(event.detail)}</p>
              )}
              <time className="text-xs text-muted-foreground tabular-nums" dateTime={event.created_at}>
                {formatDateTime(event.created_at)}
              </time>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
