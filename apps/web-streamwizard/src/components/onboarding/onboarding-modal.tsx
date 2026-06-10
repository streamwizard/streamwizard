"use client";

import { useState } from "react";
import { useSession } from "@/providers/session-provider";
import { useSessionStore } from "@/stores/session-store";
import { completeOnboarding } from "@/actions/supabase/user/settings";
import { MemesStep } from "./steps/memes-step";
import { SyncClipsStep } from "./steps/sync-clips-step";
import { SyncNowStep } from "./steps/sync-now-step";
import { DiscordStep } from "./steps/discord-step";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui";
import { Button } from "@repo/ui";

interface OnboardingValues {
  memes_enabled: boolean;
  sync_clips_on_end: boolean;
}

interface StepConfig {
  id: string;
  component: (props: { values: OnboardingValues; onChange: (values: Partial<OnboardingValues>) => void }) => React.ReactNode;
}

const steps: StepConfig[] = [
  {
    id: "memes",
    component: ({ values, onChange }) => (
      <MemesStep value={values.memes_enabled} onChange={(v) => onChange({ memes_enabled: v })} />
    ),
  },
  {
    id: "sync-clips",
    component: ({ values, onChange }) => (
      <SyncClipsStep value={values.sync_clips_on_end} onChange={(v) => onChange({ sync_clips_on_end: v })} />
    ),
  },
];

function buildSteps(hasClips: boolean): StepConfig[] {
  return [
    ...steps,
    {
      id: "sync-now",
      component: () => <SyncNowStep hasClips={hasClips} />,
    },
    {
      id: "discord",
      component: () => <DiscordStep />,
    },
  ];
}

export function OnboardingModal({ hasClips }: { hasClips: boolean }) {
  const { preferences, setPreferences } = useSessionStore();
  const allSteps = buildSteps(hasClips);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<OnboardingValues>({
    memes_enabled: preferences.memes_enabled,
    sync_clips_on_end: preferences.sync_clips_on_end,
  });

  if (preferences.onboarding_completed) return null;

  function handleChange(partial: Partial<OnboardingValues>) {
    setValues((prev) => ({ ...prev, ...partial }));
  }

  async function handleFinish() {
    setSaving(true);
    const ok = await completeOnboarding(values);
    setSaving(false);
    if (!ok) return;
    setPreferences({ ...preferences, ...values, onboarding_completed: true });
  }

  const isLast = step === allSteps.length - 1;
  const CurrentStep = allSteps[step].component;

  return (
    <Dialog open>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Let's get you set up.</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <CurrentStep values={values} onChange={handleChange} />
        </div>

        <div className="flex gap-1 justify-center py-1">
          {allSteps.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"}`}
            />
          ))}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
          >
            Back
          </Button>
          {isLast ? (
            <Button onClick={handleFinish} disabled={saving}>
              {saving ? "Saving..." : "Let's go"}
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
