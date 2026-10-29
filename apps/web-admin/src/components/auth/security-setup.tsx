"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";
import { TotpEnroll } from "@/components/auth/totp-enroll";

/**
 * Forced first-time setup: an authenticator app is required to continue.
 * Verifying TOTP upgrades this session to aal2, so "Continue" can go straight
 * to the dashboard.
 */
export function SecuritySetup() {
  const router = useRouter();
  const [done, setDone] = useState(false);

  return (
    <div className="space-y-4">
      <TotpEnroll onVerified={() => setDone(true)} />
      {done && (
        <Button type="button" className="w-full" onClick={() => router.replace("/overview")}>
          Continue to the dashboard
        </Button>
      )}
    </div>
  );
}
