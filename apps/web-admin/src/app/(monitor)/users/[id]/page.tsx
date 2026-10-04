import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getAdminUserUsage, listUserActivity } from "@repo/supabase/queries/admin-users";
import { UserOverview } from "@/components/users/user-overview";
import { assertAdmin } from "@/lib/assert-admin";
import { loadUserAuthState } from "@/lib/user-auth";
import { loadAdminUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function UserOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [adminId, user] = await Promise.all([assertAdmin(), loadAdminUser(id)]);
  const [usage, activity, auth] = await Promise.all([
    getAdminUserUsage(supabaseAdmin, user.id),
    listUserActivity(supabaseAdmin, "platform", { userId: user.id, twitchUserId: user.twitch?.userId ?? null }, 1, 5),
    loadUserAuthState(user.id),
  ]);

  return <UserOverview user={user} usage={usage} activity={activity.rows} auth={auth} isSelf={adminId === user.id} />;
}
