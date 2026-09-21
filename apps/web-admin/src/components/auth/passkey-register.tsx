"use client";

import { useState } from "react";
import { Check, KeyRound, Loader2 } from "lucide-react";
import { Button, Input, Label } from "@repo/ui";
import { supabase } from "@repo/supabase/next/client";
import { isWebAuthnCancel, useDefaultPasskeyName, usePasskeySupport } from "@/lib/webauthn";

const MAX_NAME = 120;

/**
 * Registers a passkey for the signed-in admin. Registration does not change
 * the current session (it stays whatever it was), which is why /auth/setup
 * asks the admin to sign in with the new passkey afterwards when they skipped
 * the authenticator. Shared by /auth/setup and /security.
 */
export function PasskeyRegister({
  onRegistered,
  compact = false,
}: {
  onRegistered: (passkey: { id: string; friendlyName: string }) => void;
  compact?: boolean;
}) {
  const supported = usePasskeySupport();
  const defaultName = useDefaultPasskeyName();
  // Empty until the admin types; the UA-based guess is the placeholder and the
  // fallback, so there is no SSR/client mismatch on the input's value.
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!supported) {
    return <p className="text-sm text-muted-foreground">This browser can&apos;t create passkeys. Try Chrome, Safari or Edge.</p>;
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
        <Check className="size-4" /> Passkey saved.
      </div>
    );
  }

  const register = async () => {
    const friendlyName = name.trim().slice(0, MAX_NAME) || defaultName;
    setPending(true);
    setError(null);
    try {
      const { data, error: registerError } = await supabase.auth.registerPasskey();
      if (registerError || !data) {
        if (!isWebAuthnCancel(registerError)) setError(registerError?.message ?? "Couldn't create the passkey.");
        return;
      }
      // registerPasskey() has no name parameter; set it right after.
      if (friendlyName) await supabase.auth.passkey.update({ passkeyId: data.id, friendlyName });
      setDone(true);
      onRegistered({ id: data.id, friendlyName });
    } catch (err) {
      if (!isWebAuthnCancel(err)) setError(err instanceof Error ? err.message : "Couldn't create the passkey.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3">
      {!compact && (
        <p className="text-sm text-muted-foreground">
          Uses Face ID, Touch ID, Windows Hello or a security key. Nothing to type next time.
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="passkey-name">Name</Label>
        <Input
          id="passkey-name"
          value={name}
          maxLength={MAX_NAME}
          onChange={(e) => setName(e.target.value)}
          placeholder={defaultName}
        />
      </div>
      <Button type="button" onClick={register} disabled={pending} className="w-full sm:w-auto">
        {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
        Create passkey
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
