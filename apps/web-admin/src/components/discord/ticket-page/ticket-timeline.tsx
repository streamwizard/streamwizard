"use client";

import { useState } from "react";
import type { DiscordTicket, DiscordTicketEvent } from "@repo/supabase/queries/tickets";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { displayName, type DiscordProfile } from "@/lib/discord/profile-names";
import { formatDateTime, formatDateTimeShort } from "@/lib/discord/tickets";
import { cn } from "@/lib/utils";

const EVENT_LABELS: Record<string, string> = {
  opened: "Opened",
  claimed: "Claimed",
  unclaimed: "Released",
  closed: "Closed",
  member_added: "Added",
  member_removed: "Removed",
  moved: "Moved",
  transferred: "Handed to",
  priority_changed: "Priority",
  renamed: "Subject changed",
  topic_edited: "Topic edited",
  stale_warned: "Reminded: gone quiet",
  close_requested: "Asked to close",
  close_rejected: "Close declined",
  close_request_accepted: "Close request accepted",
  close_request_rejected: "Kept open",
  close_request_expired: "Close request expired",
  feedback_submitted: "Rated by the opener",
  tag_replied: "Tag auto-replied",
};

/** Events that open or end the ticket get a solid marker; the rest are hollow. */
const MILESTONES = new Set(["opened", "closed"]);

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

const SHOWN_WHEN_FOLDED = 6;

export function TicketTimeline({
  ticket,
  events,
  profiles,
}: {
  ticket: DiscordTicket;
  events: DiscordTicketEvent[];
  profiles: Record<string, DiscordProfile>;
}) {
  const [expanded, setExpanded] = useState(false);
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

  // Long histories fold to the latest few; the opening stays visible so the
  // list still reads as a story.
  const hidden = expanded ? 0 : Math.max(0, timeline.length - SHOWN_WHEN_FOLDED - 1);
  const shown = hidden > 0 ? [timeline[0]!, ...timeline.slice(1 + hidden)] : timeline;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-3 border-l pl-4">
          {shown.map((event, index) => {
            const change = eventChange(event.detail);
            return (
              <li key={event.id} className="relative text-sm">
                <span
                  className={cn(
                    "absolute top-1.5 -left-[calc(1rem+4.5px)] size-2 rounded-full bg-background",
                    MILESTONES.has(event.type) ? "bg-foreground" : "border border-muted-foreground/60",
                  )}
                  aria-hidden
                />
                <p className="leading-snug">
                  <span className="font-medium">{EVENT_LABELS[event.type] ?? event.type}</span>
                  {event.target_name && <span> {event.target_name}</span>}
                  {change && <span className="text-muted-foreground"> {change}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {event.actor_name && <>{event.actor_name} · </>}
                  <time dateTime={event.created_at} title={formatDateTime(event.created_at)} className="tabular-nums">
                    {formatDateTimeShort(event.created_at)}
                  </time>
                </p>
                {index === 0 && hidden > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 -ml-2 h-7 text-xs text-muted-foreground"
                    onClick={() => setExpanded(true)}
                  >
                    Show {hidden} more
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
