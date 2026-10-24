"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui";
import type { DraftRecoveryPrompt } from "@/hooks/use-content-draft-recovery";

/** "3 minutes ago", give or take — enough to judge whether the copy is worth keeping. */
function relativeTime(iso: string | null): string {
  if (!iso) return "earlier";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "earlier";

  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "less than a minute ago";
  if (minutes === 1) return "a minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.round(minutes / 60);
  if (hours === 1) return "an hour ago";
  if (hours < 24) return `${hours} hours ago`;

  const days = Math.round(hours / 24);
  return days === 1 ? "a day ago" : `${days} days ago`;
}

export function RestoreDraftDialog({ open, savedAt, onRestore, onDiscard }: DraftRecoveryPrompt) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onDiscard()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Pick up where you left off?</AlertDialogTitle>
          <AlertDialogDescription>
            This browser kept changes from {relativeTime(savedAt)} that never reached the server. Bring them back, or
            carry on from the saved version.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscard}>Use the saved one</AlertDialogCancel>
          <AlertDialogAction onClick={onRestore}>Restore my changes</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
