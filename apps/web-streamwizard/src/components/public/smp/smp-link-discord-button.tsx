"use client";

import { useTransition } from "react";
import { linkDiscord } from "@/actions/auth/link-discord";

/* Step two: the same link action as onboarding and settings, returning to the stepper. */
export function SmpLinkDiscordButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => linkDiscord("/smp#join"))}
      disabled={pending}
      className="pixel-btn pixel-btn-primary"
    >
      {pending ? "Opening Discord…" : "Link Discord"}
    </button>
  );
}
