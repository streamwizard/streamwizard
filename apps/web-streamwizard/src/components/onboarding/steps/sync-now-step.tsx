"use client";

import { useState } from "react";
import { SyncBroadcasterClips } from "@/actions/twitch/clips";
import { RefreshCcw, Check } from "lucide-react";
import { Button, LoadingSpinner } from "@repo/ui";

interface SyncNowStepProps {
  hasClips: boolean;
}

type Feedback = { type: "info" | "error"; message: string; readyAt?: string } | null;

export function SyncNowStep({ hasClips }: SyncNowStepProps) {
  const [state, setState] = useState<"idle" | "syncing" | "done">("idle");
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function handleSync() {
    setState("syncing");
    setFeedback(null);

    const response = await SyncBroadcasterClips();

    if (response.success) {
      setState("done");
      return;
    }

    setState("idle");

    if (response.skipped) {
      const readyAt = response.lastSync
        ? new Date(new Date(response.lastSync).getTime() + 60 * 60 * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : undefined;
      setFeedback({ type: "info", message: "Already synced recently.", readyAt });
    } else {
      setFeedback({ type: "error", message: response.message || "Error syncing clips" });
    }
  }

  if (state === "done") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Done.</h2>
          <p className="text-sm text-muted-foreground">
            Your clips are in. Slightly less chaotic now.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Check className="h-4 w-4 text-primary shrink-0" />
          Clips synced
        </div>
      </div>
    );
  }

  if (hasClips) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">You've got clips.</h2>
          <p className="text-sm text-muted-foreground">
            We already have your clips — but if you streamed recently and want to pull in the latest ones now, go for it.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={handleSync} disabled={state === "syncing"}>
            {state === "syncing" ? (
              <>
                <LoadingSpinner />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Sync latest clips
              </>
            )}
          </Button>
          {feedback && (
            <p className={`text-xs ${feedback.type === "error" ? "text-destructive" : "text-muted-foreground"}`}>
              {feedback.message}{feedback.readyAt ? ` You can sync again at ${feedback.readyAt}.` : ""}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">No clips yet.</h2>
        <p className="text-sm text-muted-foreground">
          We haven't pulled in your Twitch clips yet. Do it now or hit "Let's go" and grab them later from the dashboard.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button onClick={handleSync} disabled={state === "syncing"}>
          {state === "syncing" ? (
            <>
              <LoadingSpinner />
              Pulling in your clips...
            </>
          ) : (
            <>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Grab my clips
            </>
          )}
        </Button>
        {feedback && (
          <div className={`text-xs ${feedback.type === "error" ? "text-destructive" : "text-muted-foreground"}`}>
            <p>{feedback.message}</p>
            {feedback.readyAt && <p>You can sync again at {feedback.readyAt}.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
