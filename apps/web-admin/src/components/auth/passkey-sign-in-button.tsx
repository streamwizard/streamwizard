"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@repo/ui";
import { supabase } from "@repo/supabase/next/client";
import { isWebAuthnCancel, usePasskeySupport } from "@/lib/webauthn";

/**
 * Signs in with a discoverable passkey and lands on the dashboard. Used on the
 * login page (instead of Twitch) and on /auth/verify and /auth/setup, where
 * it *replaces* the Twitch-only session with a passkey one that passes the
 * strength gate. The browser client writes the new session cookies before
 * resolving, so a plain navigation is enough for the server to see it.
 */
export function PasskeySignInButton({
  label = "Sign in with a passkey",
  variant = "outline",
  className,
}: {
  label?: string;
  variant?: "outline" | "default";
  className?: string;
}) {
  const router = useRouter();
  const supported = usePasskeySupport();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!supported) return null;

  const signIn = async () => {
    setPending(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPasskey();
      if (signInError) {
        if (!isWebAuthnCancel(signInError)) setError("Passkey sign-in failed. Try again, or use Twitch.");
        return;
      }
      router.replace("/overview");
    } catch (err) {
      if (!isWebAuthnCancel(err)) setError("Passkey sign-in failed. Try again, or use Twitch.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={className}>
      <Button type="button" variant={variant} className="w-full" onClick={signIn} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
        {label}
      </Button>
      {error && <p className="mt-2 text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
