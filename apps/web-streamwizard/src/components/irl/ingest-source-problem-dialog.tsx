"use client";

import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@repo/ui";
import type { IngestSourceAlertState, IngestSourceProblem } from "@/types/obs";

type IngestSourceProblemDialogProps = {
  state: IngestSourceAlertState;
  problem: IngestSourceProblem | null;
  onPutBack: () => void;
  onLeave: () => void;
};

const ERRORS: Partial<Record<IngestSourceAlertState, string>> = {
  failed: "Couldn't fix it. Add it again with Add IRL feed, or from the Ingest tab on your dashboard.",
};

// Shown on the cloud OBS dashboard and in the OBS viewer window when an
// ingest source is removed from a scene or its URL stops pulling a feed.
export function IngestSourceProblemDialog({ state, problem, onPutBack, onLeave }: IngestSourceProblemDialogProps) {
  const restoring = state === "restoring";
  const error = ERRORS[state];
  const broken = problem?.kind === "broken";

  return (
    <AlertDialog
      open={state !== "hidden" && problem !== null}
      onOpenChange={(open) => {
        if (!open && !restoring) onLeave();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{broken ? "Your phone feed's link is broken" : "Your phone feed is gone from OBS"}</AlertDialogTitle>
          <AlertDialogDescription>
            {problem?.kind === "removed" && (
              <>
                &quot;{problem.sourceName}&quot; was removed from the &quot;{problem.sceneName}&quot; scene. That&apos;s
                the feed from your phone or encoder, so viewers see nothing on that scene until it&apos;s back.
              </>
            )}
            {problem?.kind === "broken" && (
              <>
                &quot;{problem.sourceName}&quot; doesn&apos;t point at your StreamWizard feed any more. That&apos;s the
                feed from your phone or encoder, so viewers see nothing from it until the link is fixed.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={restoring}>Leave it</AlertDialogCancel>
          <Button onClick={onPutBack} disabled={restoring}>
            {restoring && <Loader2 className="size-4 animate-spin" />}
            {restoring ? (broken ? "Fixing it…" : "Putting it back…") : broken ? "Fix it" : "Put it back"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
