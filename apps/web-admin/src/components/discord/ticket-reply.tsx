"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, NativeSelect, NativeSelectOption, Textarea } from "@repo/ui";
import { sendTicketReply } from "@/actions/discord-ticket-actions";

const MAX = 2000;

export interface ReplyTag {
  name: string;
  content: string;
}

/** Reply box under an open ticket's conversation. Ctrl/Cmd+Enter sends; a tag pastes its answer in. */
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
    <div className="space-y-2 border-t pt-4">
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
      />
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="flex flex-wrap items-center gap-2">
          <span>The bot posts this with your name and avatar. Ctrl+Enter sends.</span>
          {tags.length > 0 && (
            <NativeSelect
              aria-label="Insert a tag"
              value=""
              disabled={sending}
              className="h-7 text-xs"
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
        <span className="flex items-center gap-3">
          <span className="tabular-nums">
            {content.length}/{MAX}
          </span>
          <Button size="sm" onClick={send} disabled={!trimmed || sending}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </span>
      </div>
    </div>
  );
}
