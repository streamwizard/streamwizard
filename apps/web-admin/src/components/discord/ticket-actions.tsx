"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
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
} from "@repo/ui";
import { claimTicketFromDashboard, closeTicketFromDashboard } from "@/actions/discord-ticket-actions";
import { toastResult } from "./toast-result";

interface TicketActionsProps {
  ticketNumber: number;
  claimed: boolean;
  /** The admin's Discord account is linked, so the bot can act as them. */
  linked: boolean;
}

export function TicketActions({ ticketNumber, claimed, linked }: TicketActionsProps) {
  const router = useRouter();
  const [claiming, startClaim] = useTransition();
  const [closing, startClose] = useTransition();
  const busy = claiming || closing;
  const unlinkedHint = "Link your Discord account in StreamWizard to claim or close tickets";

  const claim = () =>
    startClaim(async () => {
      if (toastResult(await claimTicketFromDashboard(ticketNumber), "Ticket claimed. It's yours now.")) router.refresh();
    });

  const close = () =>
    startClose(async () => {
      if (toastResult(await closeTicketFromDashboard(ticketNumber), "Ticket closed. Conversation saved.")) router.refresh();
    });

  return (
    <>
      {!linked && <span className="text-xs text-muted-foreground">Link your Discord account to claim or close</span>}
      {!claimed && (
        <Button size="sm" variant="outline" onClick={claim} disabled={busy || !linked} title={linked ? undefined : unlinkedHint}>
          {claiming ? "Claiming…" : "Claim"}
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
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it open</AlertDialogCancel>
            <AlertDialogAction onClick={close}>Close ticket</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
