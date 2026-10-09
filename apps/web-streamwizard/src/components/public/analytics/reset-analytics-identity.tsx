"use client";

import { useEffect } from "react";
import { resetUser } from "@repo/posthog";

/*
 * For the page a deleted account lands on. The server action that deletes the
 * account ends in a redirect, so the browser never gets a moment to unlink
 * its PostHog identity the way logout does. Without this, whatever that
 * browser does next would keep attaching to a person whose account is gone.
 */
export function ResetAnalyticsIdentity() {
  useEffect(() => {
    resetUser();
  }, []);
  return null;
}
