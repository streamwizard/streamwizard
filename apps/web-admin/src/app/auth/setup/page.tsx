import { redirect } from "next/navigation";
import { getAdminInventory } from "@/lib/admin-session";
import { AuthShell } from "@/components/auth/auth-shell";
import { SecuritySetup } from "@/components/auth/security-setup";

export const dynamic = "force-dynamic";

// Forced enrolment for admins with no second factor yet. Outside the
// (monitor) group so it doesn't hit the gate it exists to satisfy.
export default async function SetupPage() {
  const { session, redirect: to } = await getAdminInventory();
  if (!session) redirect(to);
  if (session.strong) redirect("/overview");
  if (session.totpFactors.length > 0) redirect("/auth/verify");

  return (
    <AuthShell
      title="Protect your admin account"
      description="Set up an authenticator app before using the dashboard. You'll enter a code from it after each Twitch sign-in."
      email={session.email}
    >
      <SecuritySetup />
    </AuthShell>
  );
}
