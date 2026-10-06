import { Ban } from "lucide-react";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getTwitchUsernames } from "@repo/supabase/queries/platform-events";
import { listProductsWithPlans } from "@repo/supabase/queries/subscriptions";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui";
import { GrantAccessProvider } from "@/components/users/grant-access";
import { UnbanButton } from "@/components/users/moderation";
import { UserHeader } from "@/components/users/user-header";
import { PageTabs } from "@/components/page-tabs";
import { assertAdmin } from "@/lib/assert-admin";
import { PageCrumb } from "@/lib/crumbs";
import { formatDateTime } from "@/lib/discord/tickets";
import { loadUserAuthState } from "@/lib/user-auth";
import { LIVE_PLAN_STATUSES, loadAdminUser, userDisplayName } from "@/lib/users";

export default async function UserLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The Actions menu needs to know whether this is the admin's own account, and the plan catalog for Grant access.
  const [adminId, user, products] = await Promise.all([assertAdmin(), loadAdminUser(id), listProductsWithPlans(supabaseAdmin)]);
  const auth = await loadUserAuthState(user.id);
  const banner = auth?.ban ? (await getTwitchUsernames(supabaseAdmin, [auth.ban.by])).get(auth.ban.by) : null;
  const name = userDisplayName(user);
  const base = `/users/${user.id}`;
  const livePlans = user.subscriptions.filter((sub) => LIVE_PLAN_STATUSES.has(sub.status)).length;

  return (
    // One Grant access dialog for the header menu and every tab below it.
    <GrantAccessProvider products={products}>
      <div className="space-y-4 md:space-y-6">
        {/* The header breadcrumb is the way back to the list. */}
        <PageCrumb label={name} href={base} />

        <UserHeader user={user} isSelf={adminId === user.id} banned={!!auth?.bannedUntil} discordBanned={!!auth?.ban?.discord} />

        {auth?.bannedUntil && (
          <Alert variant="destructive">
            <Ban aria-hidden />
            <AlertTitle>Banned</AlertTitle>
            <AlertDescription>
              <p>
                {auth.ban ? (
                  <>
                    {banner ? `${banner} banned them` : "Banned"}
                    {auth.ban.at && (
                      <>
                        {" "}
                        on <time dateTime={auth.ban.at}>{formatDateTime(auth.ban.at)}</time>
                      </>
                    )}
                    {auth.ban.discord && ", Discord server included"}: {auth.ban.reason}
                  </>
                ) : (
                  "Banned outside this page, so there's no reason on file."
                )}
              </p>
              <div className="mt-2">
                <UnbanButton userId={user.id} name={name} discordBanned={!!auth.ban?.discord} />
              </div>
            </AlertDescription>
          </Alert>
        )}

        <PageTabs
          label="User sections"
          tabs={[
            { href: base, label: "Overview", exact: true },
            { href: `${base}/subscriptions`, label: "Plans", count: livePlans },
            { href: `${base}/eventsub`, label: "EventSub" },
            { href: `${base}/tickets`, label: "Tickets" },
            { href: `${base}/discord`, label: "Discord" },
            { href: `${base}/activity`, label: "Activity" },
          ]}
        />

        {children}
      </div>
    </GrantAccessProvider>
  );
}
