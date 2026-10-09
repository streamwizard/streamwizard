"use client";

import { trackAction } from "@/lib/track-action";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useSessionStore } from "@/stores/session-store";
import { completeOnboarding } from "@/actions/supabase/user/settings";
import { SyncBroadcasterClips } from "@/actions/twitch/clips";
import { SyncNowStep, type SyncState } from "./steps/sync-now-step";
import { DiscordLinkStep } from "./steps/discord-link-step";
import { DiscordJoinStep } from "./steps/discord-join-step";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui";
import { Button, LoadingSpinner } from "@repo/ui";
import { RefreshCcw } from "lucide-react";

interface OnboardingValues {
  memes_enabled: boolean;
  sync_clips_on_end: boolean;
  show_stream_stats: boolean;
}

// Three steps, each one something to do. The first also says hello. The
// separate welcome screen and the three preference toggles that used to come
// first are gone: the toggles keep their defaults and live in Settings for
// whoever wants them changed.
const STEP_IDS = ["sync-now", "discord-link", "discord-join"] as const;
const DISCORD_LINK_STEP_INDEX = STEP_IDS.indexOf("discord-link");
const DISCORD_JOIN_STEP_INDEX = STEP_IDS.indexOf("discord-join");

// Rendered only while the modal is actually shown, so mounting IS the event.
function OnboardingStartedTracker() {
  useEffect(() => {
    trackAction("onboarding_started", {});
  }, []);
  return null;
}

interface OnboardingProps {
  clipCount: number;
  discordStatus: "verified" | "not_member" | "not_linked";
  // Server-fetched truth. The client store's onboarding_completed defaults to
  // false and only hydrates in a later effect, so on its own it would mount
  // the wizard, for a moment, for every user already past onboarding.
  initialOnboardingCompleted: boolean;
}

// Decides whether the wizard exists at all. Everything the wizard does —
// including its window-wide Enter key listener — lives in OnboardingWizard, so
// it only runs while the wizard is on screen. It used to be one component
// with the listener above the early return, and Enter kept driving a hidden
// wizard for people who had finished it long ago.
export function OnboardingModal(props: OnboardingProps) {
  const { preferences } = useSessionStore();

  if (props.initialOnboardingCompleted || preferences.onboarding_completed) return null;

  return <OnboardingWizard clipCount={props.clipCount} discordStatus={props.discordStatus} />;
}

function OnboardingWizard({ clipCount, discordStatus }: Omit<OnboardingProps, "initialOnboardingCompleted">) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { preferences, setPreferences } = useSessionStore();
  const [step, setStep] = useState(() => {
    const marker = searchParams.get("onboarding");
    if (marker === "discord-join-step") return DISCORD_JOIN_STEP_INDEX;
    if (marker === "discord-link-step") return DISCORD_LINK_STEP_INDEX;
    return 0;
  });
  const [saving, setSaving] = useState(false);
  // Saved as they stand when onboarding finishes, and before the Discord
  // round trip. Nothing in the wizard changes them any more.
  const values = useMemo<OnboardingValues>(
    () => ({
      memes_enabled: preferences.memes_enabled,
      sync_clips_on_end: preferences.sync_clips_on_end,
      show_stream_stats: preferences.show_stream_stats,
    }),
    [preferences.memes_enabled, preferences.sync_clips_on_end, preferences.show_stream_stats],
  );

  // Resuming at a discord step after the OAuth round trip — strip the
  // marker so a refresh doesn't re-trigger the jump.
  useEffect(() => {
    const marker = searchParams.get("onboarding");
    if (marker === "discord-join-step" || marker === "discord-link-step") {
      router.replace("/dashboard/clips");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Captured in the initializer because the strip-marker effect above rewrites
  // the URL right after mount, and a mount-effect check would then see no
  // marker and miscount the OAuth resume as a fresh onboarding start.
  const [resumedMidFlow] = useState(() => !!searchParams.get("onboarding"));

  const handleNext = useCallback(() => {
    trackAction("onboarding_step_completed", {
      step_id: STEP_IDS[step]!,
      step_index: step,
      total_steps: STEP_IDS.length,
    });
    setStep((s) => s + 1);
  }, [step]);

  const isLast = step === STEP_IDS.length - 1;
  const isSyncStep = STEP_IDS[step] === "sync-now";

  // The first step has two answers instead of a Next button: grab the clips,
  // or skip. Both move on; grabbing does the sync first and only moves on once
  // it worked, so an error stays on screen with a way to retry or skip.
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const isSyncing = syncState === "syncing";
  const hasSynced = syncState === "done" || syncState === "skipped";

  const handleSync = useCallback(async () => {
    setSyncState("syncing");
    setSyncError(null);
    const response = await SyncBroadcasterClips();
    // "Skipped" is the API saying a sync ran less than an hour ago: the clips
    // are already in, which is what was asked for.
    if (response.success || response.skipped) {
      setSyncState(response.success ? "done" : "skipped");
      handleNext();
      return;
    }
    setSyncError(response.message || "Something broke. Try again?");
    setSyncState("error");
  }, [handleNext]);

  // Render the current step by referencing the imported components directly so
  // their identity stays stable across re-renders. Building these inline inside
  // an array (and rendering via a dynamic `CurrentStep` variable) gives each
  // step a new function identity every render, which remounts the subtree and
  // wipes a step's local state.
  function renderStep() {
    switch (STEP_IDS[step]) {
      case "sync-now":
        return <SyncNowStep clipCount={clipCount} state={syncState} errorMessage={syncError} />;
      case "discord-link":
        return <DiscordLinkStep linked={discordStatus !== "not_linked"} values={values} />;
      case "discord-join":
        return <DiscordJoinStep status={discordStatus === "not_linked" ? "not_member" : discordStatus} />;
      default:
        return null;
    }
  }

  const handleFinish = useCallback(async () => {
    setSaving(true);
    const ok = await completeOnboarding(values);
    setSaving(false);
    if (!ok) return;
    setPreferences({ ...preferences, ...values, onboarding_completed: true });
    router.push("/dashboard/clips");
  }, [values, preferences, setPreferences, router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      // Enter is the step's main button, whatever that is.
      if (isLast) {
        if (!saving) handleFinish();
      } else if (isSyncStep && !hasSynced) {
        if (!isSyncing) void handleSync();
      } else {
        handleNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLast, saving, handleFinish, handleNext, isSyncStep, hasSynced, isSyncing, handleSync]);

  return (
    <Dialog open>
      {!resumedMidFlow && <OnboardingStartedTracker />}
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="sr-only">Get set up</DialogTitle>
        </DialogHeader>

        <div className="min-h-[180px] py-2 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* The first part is always filled: signing in with Twitch was the
            first thing on the list, and they did it to get here. A bar that
            opens at "1 of 4 done" gets finished more often than one that
            opens at "0 of 3", for the same three steps left. */}
        <div className="flex flex-col gap-1.5 py-1">
          <div className="flex gap-1.5">
            <div className="h-1 flex-1 rounded-full bg-primary" />
            {STEP_IDS.map((id, i) => (
              <div
                key={id}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  i < step ? "bg-primary" : i === step ? "bg-primary/40" : "bg-muted"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {step === 0 ? "Twitch connected. " : ""}
            {step + 1} of {STEP_IDS.length + 1} done.
          </p>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          {isSyncStep && !hasSynced ? (
            <>
              <Button variant="ghost" onClick={handleNext} disabled={isSyncing}>
                Skip
              </Button>
              <Button onClick={handleSync} disabled={isSyncing}>
                {isSyncing ? (
                  <>
                    <span className="mr-2 h-4 w-4 shrink-0">
                      <LoadingSpinner />
                    </span>
                    Pulling in your clips...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {syncState === "error" ? "Try again" : clipCount > 0 ? "Sync latest clips" : "Grab my clips"}
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
                Back
              </Button>
              {isLast ? (
                <Button onClick={handleFinish} disabled={saving}>
                  {saving ? "Saving..." : "Take me to my clips"}
                </Button>
              ) : (
                <Button onClick={handleNext}>Next</Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
