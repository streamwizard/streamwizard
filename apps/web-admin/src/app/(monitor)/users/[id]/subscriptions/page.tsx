import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getTwitchUsernames } from "@repo/supabase/queries/platform-events";
import { UserSubscriptions } from "@/components/users/user-subscriptions";
import { loadAdminUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function UserSubscriptionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await loadAdminUser(id);
  const granterIds = user.subscriptions.flatMap((sub) => (sub.grantedBy ? [sub.grantedBy] : []));
  // The plan catalog for Grant access comes from the user layout, which owns the dialog.
  const granters = await getTwitchUsernames(supabaseAdmin, granterIds);

  return (
    <UserSubscriptions
      user={{ id: user.id, name: user.twitch?.username ?? user.name, email: user.email, avatar_url: user.avatarUrl }}
      subscriptions={user.subscriptions}
      granters={Object.fromEntries(granters)}
    />
  );
}
