"use client";

import { RefreshCw } from "lucide-react";
import type { DiscordTicket } from "@repo/supabase/queries/tickets";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { TicketRealtimeStatus } from "@/hooks/use-ticket-realtime";
import { formatDateTime } from "@/lib/discord/tickets";
import { TicketReply, type ReplyTag } from "../ticket-reply";
import { TicketTranscript, type TranscriptMessage } from "../ticket-transcript";

// The text says what is going on by itself: a phone has no hover for a tooltip.
const STATUS_LABEL: Record<TicketRealtimeStatus, { text: string; dot: string }> = {
  subscribed: { text: "Live", dot: "size-2 animate-pulse rounded-full bg-emerald-500" },
  connecting: { text: "Connecting", dot: "size-2 rounded-full bg-amber-500" },
  reconnecting: { text: "Reconnecting, checking every 30 seconds", dot: "size-2 rounded-full bg-amber-500" },
  off: { text: "", dot: "" },
};

export function TicketConversation({
  ticket,
  messages,
  names,
  tags,
  status,
  refreshing,
  onRefresh,
}: {
  ticket: DiscordTicket;
  messages: TranscriptMessage[];
  names: Record<string, string>;
  tags: ReplyTag[];
  status: TicketRealtimeStatus;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const isOpen = ticket.status === "open";
  const label = STATUS_LABEL[status];

  return (
    // On a phone the card frame goes: the conversation gets the full width of
    // the screen and scrolls with the page, never inside a box of its own.
    <Card className="max-sm:gap-3 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:py-0 max-sm:shadow-none">
      <CardHeader className="max-sm:px-0">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          Conversation
          {isOpen && (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className={label.dot} aria-hidden />
                {label.text}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-11 md:size-7"
                aria-label="Refresh conversation"
                disabled={refreshing}
                onClick={onRefresh}
              >
                <RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden />
              </Button>
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="max-sm:px-0">
        {isOpen ? (
          <div className="space-y-4">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages in the ticket channel yet.</p>
            ) : (
              <TicketTranscript messages={messages} names={names} />
            )}
            <TicketReply ticketNumber={ticket.ticket_number} tags={tags} />
          </div>
        ) : ticket.transcript_purged_at ? (
          <p className="text-sm text-muted-foreground">
            This transcript was deleted on {formatDateTime(ticket.transcript_purged_at)}, 12 months after the ticket
            closed.
          </p>
        ) : messages.length > 0 ? (
          <TicketTranscript messages={messages} names={names} />
        ) : ticket.close_code === "channel_deleted" ? (
          <p className="text-sm text-muted-foreground">
            No transcript. The channel was deleted in Discord before the bot archived anything from it.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No transcript. This ticket closed before transcripts were saved.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
