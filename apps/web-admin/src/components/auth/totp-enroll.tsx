"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button, InputOTP, InputOTPGroup, InputOTPSlot } from "@repo/ui";
import { supabase } from "@repo/supabase/next/client";

const FRIENDLY_NAME = "Authenticator app";

type EnrollState =
  | { step: "loading" }
  | { step: "error"; message: string }
  | { step: "scan"; factorId: string; qrCode: string; secret: string }
  | { step: "done" };

/**
 * TOTP enrolment: create the factor, show the QR + secret, verify one code.
 * Verifying also upgrades the current session to aal2, so the caller can go
 * straight to the dashboard afterwards. Shared by /auth/setup and /security.
 */
export function TotpEnroll({ onVerified }: { onVerified: () => void }) {
  const [state, setState] = useState<EnrollState>({ step: "loading" });
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // One enrolment per mount. React's dev StrictMode runs effects twice; without
  // this guard the second run raced the first's enroll() and Supabase rejected
  // it as a duplicate friendly name.
  const enrolment = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (enrolment.current) return;
    enrolment.current = (async () => {
      // An abandoned enrolment leaves an unverified factor behind, and Supabase
      // rejects a second enrolment with the same friendly name. Clear those
      // first so re-opening this flow always starts clean.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      // `totp` only lists verified factors; the unverified leftovers live in `all`.
      for (const f of factors?.all ?? []) {
        if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: FRIENDLY_NAME });
      if (error || !data) {
        setState({ step: "error", message: error?.message ?? "Couldn't start enrolment." });
        return;
      }
      setState({ step: "scan", factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, []);

  const verify = async (factorId: string, value: string) => {
    setVerifying(true);
    setCodeError(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: value });
    setVerifying(false);
    if (error) {
      setCodeError("That code didn't match. Check the time on your phone and try again.");
      setCode("");
      return;
    }
    setState({ step: "done" });
    onVerified();
  };

  if (state.step === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Preparing your authenticator…
      </div>
    );
  }

  if (state.step === "error") {
    return <p className="text-sm text-destructive">{state.message}</p>;
  }

  if (state.step === "done") {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
        <Check className="size-4" /> Authenticator app connected.
      </div>
    );
  }

  const { factorId, qrCode, secret } = state;
  const qrSrc = qrCode.startsWith("data:") ? qrCode : `data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`;

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked; the secret is still visible to copy by hand.
    }
  };

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Open your authenticator app (1Password, Google Authenticator, Authy…).</li>
        <li>Scan the QR code, or paste the secret.</li>
        <li>Enter the 6-digit code it shows.</li>
      </ol>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        {/* Inline SVG data URI from Supabase; next/image has nothing to optimise here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrSrc}
          alt="QR code for your authenticator app"
          width={176}
          height={176}
          className="size-44 shrink-0 rounded-md border border-border bg-white p-2"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Secret (manual entry)</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 font-mono text-xs">{secret}</code>
            <Button type="button" variant="ghost" size="icon-sm" onClick={copySecret} aria-label="Copy secret">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Code from the app</p>
        <InputOTP
          maxLength={6}
          value={code}
          onChange={setCode}
          onComplete={(value) => void verify(factorId, value)}
          disabled={verifying}
          autoFocus
        >
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {verifying && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking…
          </p>
        )}
        {codeError && <p className="text-sm text-destructive">{codeError}</p>}
      </div>
    </div>
  );
}
