"use client";

import { useId, useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Label,
  Textarea,
} from "@repo/ui";
import { changeTicketFromDashboard, claimTicketFromDashboard, closeTicketFromDashboard } from "@/actions/discord-ticket-actions";
import { toastResult } from "./toast-result";

interface TicketActionsProps {
  ticketNumber: number;
  claimed: boolean;
  /** The ticket's category lets staff claim. */
  claiming: boolean;
  /** The admin's Discord account is linked, so the bot can act as them. */
  linked: boolean;
}

const REASON_MAX = 1000;

// The bot writes the ticket row for every action; the page sees the change
// over realtime, so nothing here refreshes.
export function TicketActions({ ticketNumber, claimed, claiming, linked }: TicketActionsProps) {
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [claimPending, startClaim] = useTransition();
  const [closing, startClose] = useTransition();
  const busy = claimPending || closing;
  const unlinkedHint = "Link your Discord account in StreamWizard to work tickets from here";

  const claim = () =>
    startClaim(async () => {
      toastResult(await claimTicketFromDashboard(ticketNumber), "Ticket claimed. It's yours now.");
    });

  const release = () =>
    startClaim(async () => {
      toastResult(await changeTicketFromDashboard(ticketNumber, "release", {}), "Released. Anyone on staff can claim it.");
    });

  const close = () =>
    startClose(async () => {
      toastResult(await closeTicketFromDashboard(ticketNumber, reason.trim() || null), "Ticket closed. Conversation saved.");
    });

  return (
    <>
      {claiming && (
        <Button
          size="sm"
          variant="outline"
          onClick={claimed ? release : claim}
          disabled={busy || !linked}
          title={linked ? undefined : unlinkedHint}
        >
          {claimPending ? "Working…" : claimed ? "Release" : "Claim"}
        </Button>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="destructive" disabled={busy || !linked} title={linked ? undefined : unlinkedHint}>
            {closing ? "Closing…" : "Close ticket"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              The conversation gets saved here, then the Discord channel is deleted. You can&apos;t reopen it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor={reasonId}>Reason</Label>
            <Textarea
              id={reasonId}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={REASON_MAX}
              rows={3}
              placeholder="Fixed in the latest update"
            />
            <p className="text-xs text-muted-foreground">Optional. Saved on the ticket and shown in the ticket log.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it open</AlertDialogCancel>
            <AlertDialogAction onClick={close}>Close ticket</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
