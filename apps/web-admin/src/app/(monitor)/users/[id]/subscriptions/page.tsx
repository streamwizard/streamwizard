import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getTwitchUsernames } from "@repo/supabase/queries/platform-events";
import { listProductsWithPlans } from "@repo/supabase/queries/subscriptions";
import { UserSubscriptions } from "@/components/users/user-subscriptions";
import { loadAdminUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function UserSubscriptionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await loadAdminUser(id);
  const granterIds = user.subscriptions.flatMap((sub) => (sub.grantedBy ? [sub.grantedBy] : []));
  const [products, granters] = await Promise.all([
    listProductsWithPlans(supabaseAdmin),
    getTwitchUsernames(supabaseAdmin, granterIds),
  ]);

  return (
    <UserSubscriptions
      user={{ id: user.id, name: user.twitch?.username ?? user.name, email: user.email, avatar_url: user.avatarUrl }}
      subscriptions={user.subscriptions}
      products={products}
      granters={Object.fromEntries(granters)}
    />
  );
}
