import { redirect } from "next/navigation";
import { getAdminInventory } from "@/lib/admin-session";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyPanel } from "@/components/auth/verify-panel";

export const dynamic = "force-dynamic";

// Second step after Twitch. Outside the (monitor) group so it doesn't hit the
// gate it exists to satisfy.
export default async function VerifyPage() {
  const { session, redirect: to } = await getAdminInventory();
  if (!session) redirect(to);
  if (session.strong) redirect("/overview");

  const totpFactorId = session.totpFactors[0]?.id ?? null;
  const hasPasskey = session.passkeys.length > 0;
  if (!totpFactorId && !hasPasskey) redirect("/auth/setup");

  return (
    <AuthShell
      title="One more step"
      description={
        totpFactorId
          ? "Confirm it's you with your authenticator app."
          : "This account signs in with a passkey. Use it to continue."
      }
      email={session.email}
    >
      <VerifyPanel totpFactorId={totpFactorId} hasPasskey={hasPasskey} />
    </AuthShell>
  );
}
