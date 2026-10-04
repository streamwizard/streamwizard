import { supabaseAdmin } from "@repo/supabase/next/admin";
import { type UserListFilter, type UserListSort, getUserListStats, listUsers } from "@repo/supabase/queries/admin-users";
import { listProductsWithPlans } from "@repo/supabase/queries/subscriptions";
import { USER_FILTERS, USER_SORTS, UsersView } from "@/components/users/users-view";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type Params = { q?: string; filter?: string; sort?: string; page?: string };

const isFilter = (value: string | undefined): value is UserListFilter => !!value && value in USER_FILTERS;
const isSort = (value: string | undefined): value is UserListSort => !!value && value in USER_SORTS;

export default async function UsersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const filter = isFilter(params.filter) ? params.filter : undefined;
  const sort = isSort(params.sort) ? params.sort : "newest";
  const search = params.q?.trim() || undefined;

  // The plan catalog feeds the row menu's Grant access, which used to live on /subscriptions.
  const [stats, { users, total }, products] = await Promise.all([
    getUserListStats(supabaseAdmin),
    listUsers(supabaseAdmin, { search, filter, sort }, page, PAGE_SIZE),
    listProductsWithPlans(supabaseAdmin),
  ]);

  return (
    <UsersView
      stats={stats}
      users={users}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      search={search}
      filter={filter}
      sort={sort}
      products={products}
    />
  );
}
