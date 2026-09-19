"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@repo/ui";
import { supabase } from "@repo/supabase/next/client";
import { PasskeySignInButton } from "@/components/auth/passkey-sign-in-button";

/**
 * Second step after a Twitch sign-in. Either the admin proves the TOTP factor
 * (session becomes aal2) or signs in again with a passkey (session is
 * replaced by one whose amr carries `passkey`). Both pass the gate.
 */
export function VerifyPanel({ totpFactorId, hasPasskey }: { totpFactorId: string | null; hasPasskey: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async (value: string) => {
    if (!totpFactorId) return;
    setVerifying(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: totpFactorId, code: value });
    if (verifyError) {
      setVerifying(false);
      setError("That code didn't match. Try the next one your app shows.");
      setCode("");
      return;
    }
    router.replace("/overview");
  };

  return (
    <div className="space-y-6">
      {totpFactorId && (
        <div className="space-y-3">
          <p className="text-center text-sm font-medium">Enter the code from your authenticator app</p>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              onComplete={(value) => void verify(value)}
              disabled={verifying}
              autoFocus
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          {verifying && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Checking…
            </p>
          )}
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
        </div>
      )}

      {totpFactorId && hasPasskey && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>
      )}

      {hasPasskey && (
        <PasskeySignInButton label={totpFactorId ? "Use a passkey instead" : "Continue with your passkey"} variant={totpFactorId ? "outline" : "default"} />
      )}
    </div>
  );
}
