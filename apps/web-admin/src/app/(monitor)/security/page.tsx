import { requireAdminSession } from "@/lib/admin-session";
import { PageHeader } from "@/components/widgets/page-header";
import { SecuritySettings } from "@/components/auth/security-settings";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  // The layout already gated; calling again here is cheap and gives us the
  // factor inventory for this render.
  const session = await requireAdminSession();
  const totp = session.totpFactors[0];

  return (
    <div className="space-y-6">
      <PageHeader title="Security" description="Second factors for your admin account. Keep both so one lost device can't lock you out." />
      <SecuritySettings
        totp={totp ? { id: totp.id, friendlyName: totp.friendly_name || "Authenticator app", createdAt: totp.created_at } : null}
        passkeys={session.passkeys.map((p) => ({
          id: p.id,
          friendlyName: p.friendly_name || "Passkey",
          createdAt: p.created_at,
          lastUsedAt: p.last_used_at ?? null,
        }))}
      />
    </div>
  );
}
