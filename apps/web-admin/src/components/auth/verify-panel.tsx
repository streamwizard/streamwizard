"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@repo/ui";
import { supabase } from "@repo/supabase/next/client";

/**
 * Second step after a Twitch sign-in: the admin proves the TOTP factor and the
 * session becomes aal2, which passes the gate.
 */
export function VerifyPanel({ totpFactorId }: { totpFactorId: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async (value: string) => {
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
    <div className="space-y-3">
      <p className="text-center text-sm font-medium">Enter the code from your authenticator app</p>
      <div className="flex justify-center">
        <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={(value) => void verify(value)} disabled={verifying} autoFocus>
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
  );
}
