"use client";

import { useTransition } from "react";
import { captureEvent } from "@repo/posthog";
import { login } from "@/actions/auth/login";

/*
 * Step one: sign in with Twitch and come back to the stepper. The same
 * `login()` action the site's Twitch buttons use, with a pixel button on top
 * instead of the shared one, which brings its own look.
 */
export function SmpLoginButton() {
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    // Fire before the server action: login() ends in a redirect to Twitch.
    captureEvent("login_clicked", { source: "smp_signup" });
    startTransition(() => login("/smp#join"));
  };

  return (
    <button type="button" onClick={handleClick} disabled={pending} className="pixel-btn pixel-btn-primary">
      {pending ? "Opening Twitch…" : "Sign in with Twitch"}
    </button>
  );
}
