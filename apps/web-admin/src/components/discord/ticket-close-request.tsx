"use client";

import { useTransition } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { changeTicketFromDashboard } from "@/actions/discord-ticket-actions";
import { formatDateTime } from "@/lib/discord/tickets";
import { toastResult } from "./toast-result";

interface TicketCloseRequestProps {
  ticketNumber: number;
  requestedAt: string;
  expiresAt: string | null;
  requestedBy: string;
  /** The admin's Discord account is linked, so the bot can act as them. */
  linked: boolean;
}

/** The opener asked to close the ticket. Same accept and reject as the buttons in Discord. */
export function TicketCloseRequest({ ticketNumber, requestedAt, expiresAt, requestedBy, linked }: TicketCloseRequestProps) {
  const [pending, start] = useTransition();

  const answer = (change: "close-accept" | "close-reject", done: string) =>
    start(async () => {
      toastResult(await changeTicketFromDashboard(ticketNumber, change, {}), done);
    });

  return (
    <Card className="border-amber-500/50">
      <CardHeader>
        <CardTitle className="text-base">Close request</CardTitle>
        <CardDescription>
          {requestedBy} asked to close this ticket on {formatDateTime(requestedAt)}.
          {expiresAt ? ` Without an answer it lapses on ${formatDateTime(expiresAt)} and the ticket stays open.` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending || !linked} onClick={() => answer("close-accept", "Ticket closed. Conversation saved.")}>
          {pending ? "Working…" : "Accept and close"}
        </Button>
        <Button size="sm" variant="outline" disabled={pending || !linked} onClick={() => answer("close-reject", "Kept open.")}>
          Keep it open
        </Button>
      </CardContent>
    </Card>
  );
}
