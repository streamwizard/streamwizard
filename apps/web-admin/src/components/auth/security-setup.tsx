"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Smartphone } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { TotpEnroll } from "@/components/auth/totp-enroll";
import { PasskeyRegister } from "@/components/auth/passkey-register";
import { PasskeySignInButton } from "@/components/auth/passkey-sign-in-button";

/**
 * Forced first-time setup. At least one method is required to continue; both
 * are recommended so losing a phone or a laptop doesn't mean a lockout.
 *
 * Verifying TOTP upgrades this session to aal2, so "Continue" can go straight
 * to the dashboard. Registering a passkey does not touch the session, so the
 * passkey-only path ends with a passkey sign-in instead.
 */
export function SecuritySetup() {
  const router = useRouter();
  const [totpDone, setTotpDone] = useState(false);
  const [passkeyDone, setPasskeyDone] = useState(false);
  const [totpOpen, setTotpOpen] = useState(false);
  const [passkeyOpen, setPasskeyOpen] = useState(false);

  const anyDone = totpDone || passkeyDone;
  const bothDone = totpDone && passkeyDone;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={totpDone ? "border-emerald-500/40" : undefined}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="size-4" /> Authenticator app
              {totpDone && <Check className="ml-auto size-4 text-emerald-600 dark:text-emerald-400" />}
            </CardTitle>
            <CardDescription>A 6-digit code after each Twitch sign-in.</CardDescription>
          </CardHeader>
          <CardContent>
            {totpDone ? (
              <p className="text-sm text-muted-foreground">Connected.</p>
            ) : totpOpen ? (
              <TotpEnroll onVerified={() => setTotpDone(true)} />
            ) : (
              <Button type="button" variant="outline" onClick={() => setTotpOpen(true)}>
                Set up authenticator
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className={passkeyDone ? "border-emerald-500/40" : undefined}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4" /> Passkey
              {passkeyDone && <Check className="ml-auto size-4 text-emerald-600 dark:text-emerald-400" />}
            </CardTitle>
            <CardDescription>Sign in with Face ID, Touch ID or a security key. No Twitch redirect.</CardDescription>
          </CardHeader>
          <CardContent>
            {passkeyDone ? (
              <p className="text-sm text-muted-foreground">Saved.</p>
            ) : passkeyOpen ? (
              <PasskeyRegister compact onRegistered={() => setPasskeyDone(true)} />
            ) : (
              <Button type="button" variant="outline" onClick={() => setPasskeyOpen(true)}>
                Add a passkey
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        {!anyDone && <p className="text-center text-sm text-muted-foreground">Set up at least one to continue.</p>}

        {anyDone && !bothDone && (
          <p className="text-center text-sm text-muted-foreground">
            One is enough for now. You can add the other later under Security.
          </p>
        )}

        {totpDone && (
          <Button type="button" className="w-full" onClick={() => router.replace("/overview")}>
            Continue to the dashboard
          </Button>
        )}

        {!totpDone && passkeyDone && (
          <div className="space-y-2">
            <PasskeySignInButton label="Sign in with your new passkey" variant="default" />
            <p className="text-center text-xs text-muted-foreground">
              Your current session came from Twitch alone. Signing in with the passkey replaces it with one the dashboard trusts.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
