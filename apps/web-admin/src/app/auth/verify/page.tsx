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

  const totpFactorId = session.totpFactors[0]?.id;
  if (!totpFactorId) redirect("/auth/setup");

  return (
    <AuthShell
      title="One more step"
      description="Confirm it's you with your authenticator app."
      email={session.email}
    >
      <VerifyPanel totpFactorId={totpFactorId} />
    </AuthShell>
  );
}
