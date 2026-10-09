"use client";

import Image from "next/image";
import { AlertCircle, Check, Clapperboard } from "lucide-react";
import { useSession } from "@/providers/session-provider";

export type SyncState = "idle" | "syncing" | "done" | "skipped" | "error";

interface SyncNowStepProps {
  clipCount: number;
  state: SyncState;
  errorMessage: string | null;
}

// The first thing a new user sees: a hello, and the one job worth doing right
// away. The separate welcome screen and the three preference toggles that used
// to come before this are gone; the toggles keep their defaults and live in
// Settings.
//
// The step only shows where things stand. Its two choices, grab the clips or
// skip, are the wizard's own footer buttons, so there is no "Next" to wonder
// about and no second button to find inside the step.
export function SyncNowStep({ clipCount, state, errorMessage }: SyncNowStepProps) {
  const user = useSession();
  const name = user.user_metadata?.full_name ?? user.user_metadata?.preferred_username ?? "streamer";
  const avatar = user.user_metadata?.avatar_url as string | undefined;
  const hasClips = clipCount > 0;
  const hasSynced = state === "done" || state === "skipped";

  let heading: string;
  let description: string;
  if (hasSynced) {
    heading = "All caught up.";
    description = "Your clips are in StreamWizard, ready to sort. You can pull in more any time.";
  } else if (hasClips) {
    heading = "We already have some clips of you.";
    description = "No idea how, but we do. Want to pull in the latest ones while you're here?";
  } else {
    heading = "No clips yet.";
    description = "Grab your Twitch clips now, or skip it. New ones come in on their own when a stream ends.";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        {avatar ? (
          <Image
            src={avatar}
            alt={name}
            width={52}
            height={52}
            className="shrink-0 rounded-full border border-white/10"
          />
        ) : (
          <div className="h-13 w-13 shrink-0 rounded-full bg-purple-500/20 border border-purple-500/30" />
        )}
        <div>
          <h2 className="text-xl font-semibold">Welcome, {name}.</h2>
          <p className="text-sm text-muted-foreground">Let&apos;s get three things sorted. First up: your clips.</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-base font-medium">{heading}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {hasClips && (
        <div className="relative rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Clapperboard className="h-4 w-4 text-purple-400" />
            </span>
            <div>
              <p className="text-sm font-medium">{clipCount.toLocaleString()} clips synced</p>
              <p className="text-xs text-muted-foreground">from your Twitch account</p>
            </div>
          </div>
        </div>
      )}

      {state === "done" && (
        <div className="flex items-center gap-2 text-sm text-primary">
          <Check className="h-4 w-4 shrink-0" />
          {hasClips ? "Latest clips pulled in." : "Your clips are in. Slightly less chaotic now."}
        </div>
      )}

      {state === "skipped" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Check className="h-4 w-4 shrink-0 text-primary" />
          Already up to date. Nothing new to pull in.
        </div>
      )}

      {state === "error" && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMessage}
        </div>
      )}
    </div>
  );
}
