"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, NativeSelect, NativeSelectOption, Textarea } from "@repo/ui";
import { sendTicketReply } from "@/actions/discord-ticket-actions";
import { cn } from "@/lib/utils";

const MAX = 2000;

export interface ReplyTag {
  name: string;
  content: string;
}

/**
 * Reply box of an open ticket's conversation. Ctrl/Cmd+Enter sends; a tag
 * pastes its answer in. Below 1024px it floats at the bottom of the screen,
 * above the phone bottom bar, while the conversation scrolls behind it; on a
 * desktop it sits under the transcript.
 */
export function TicketReply({ ticketNumber, tags = [] }: { ticketNumber: number; tags?: ReplyTag[] }) {
  const [content, setContent] = useState("");
  const [sending, startSend] = useTransition();
  const trimmed = content.trim();

  const send = () => {
    if (!trimmed || sending) return;
    startSend(async () => {
      const result = await sendTicketReply(ticketNumber, trimmed);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      // The bot archives the message it posted; that row reaches the page over realtime.
      setContent("");
    });
  };

  return (
    <div
      className={cn(
        "sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 space-y-2 rounded-lg border bg-background p-2 shadow-md md:bottom-4",
        // Covers the gap under the box, so no line of the transcript shows between it and the bottom bar.
        "after:absolute after:inset-x-0 after:top-full after:h-5 after:bg-background sm:after:bg-card lg:after:hidden",
        "lg:static lg:rounded-none lg:border-x-0 lg:border-b-0 lg:bg-transparent lg:p-0 lg:pt-4 lg:shadow-none",
      )}
    >
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, MAX))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
        placeholder="Reply in the ticket channel"
        aria-label="Reply"
        rows={3}
        disabled={sending}
        // Starts at one line on a phone and grows with the text; capped so the box never fills the space the keyboard leaves.
        className="max-h-32 min-h-10 lg:max-h-none lg:min-h-16"
      />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs text-muted-foreground">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          {/* Desktop only: the floating box stays two rows tall, and a phone has no Ctrl key. */}
          <span className="hidden lg:inline">The bot posts this with your name and avatar. Ctrl+Enter sends.</span>
          {tags.length > 0 && (
            <NativeSelect
              aria-label="Insert a tag"
              value=""
              disabled={sending}
              className="h-11 text-base md:h-7 md:py-0 md:text-xs"
              onChange={(event) => {
                const tag = tags.find((candidate) => candidate.name === event.target.value);
                if (!tag) return;
                setContent((current) => `${current.trimEnd()}${current.trim() ? "\n" : ""}${tag.content}`.slice(0, MAX));
              }}
            >
              <NativeSelectOption value="">Insert a tag…</NativeSelectOption>
              {tags.map((tag) => (
                <NativeSelectOption key={tag.name} value={tag.name}>
                  {tag.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </span>
        <span className="ml-auto flex items-center gap-3">
          <span className="tabular-nums">
            {content.length}/{MAX}
          </span>
          <Button size="sm" className="h-11 md:h-8" onClick={send} disabled={!trimmed || sending}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </span>
      </div>
    </div>
  );
}
