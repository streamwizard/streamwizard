"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Textarea } from "@repo/ui";
import { sendTicketReply } from "@/actions/discord-ticket-actions";

const MAX = 2000;

/** Reply box under an open ticket's conversation. Ctrl/Cmd+Enter sends. */
export function TicketReply({ ticketNumber }: { ticketNumber: number }) {
  const router = useRouter();
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
      setContent("");
      router.refresh();
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
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>The bot posts this with your name and avatar. Ctrl+Enter sends.</span>
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
