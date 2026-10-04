import Link from "next/link";
import { CreditCard, SearchX, ShieldCheck, Users } from "lucide-react";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  type UserListFilter,
  type UserListRow,
  type UserListSort,
  getUserListStats,
  listUsers,
} from "@repo/supabase/queries/admin-users";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
  NativeSelect,
  NativeSelectOption,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import { TicketFiltersForm } from "@/components/discord/ticket-filters-form";
import { PageHeader } from "@/components/widgets/page-header";
import { StatCard } from "@/components/widgets/stat-card";
import { formatDateTime, formatRelativeTime } from "@/lib/discord/tickets";
import { PLAN_STATUS_LABELS, planStatusVariant, userAvatarUrl, userDisplayName } from "@/lib/users";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const FILTERS: Record<UserListFilter, string> = {
  paying: "Has a plan",
  admin: "Admins",
  discord: "Discord linked",
  no_twitch: "No Twitch",
};

const SORTS: Record<UserListSort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  name: "Name",
};

type Params = { q?: string; filter?: string; sort?: string; page?: string };

const isFilter = (value: string | undefined): value is UserListFilter => !!value && value in FILTERS;
const isSort = (value: string | undefined): value is UserListSort => !!value && value in SORTS;

function UserCell({ user }: { user: UserListRow }) {
  const name = userDisplayName(user);
  const avatar = userAvatarUrl(user);
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-8">
        {avatar && <AvatarImage src={avatar} alt="" />}
        <AvatarFallback className="text-xs">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/users/${user.id}`}
            className="truncate font-medium after:absolute after:inset-0 focus-visible:outline-none"
          >
            {name}
          </Link>
          {user.isLive && (
            <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <span aria-hidden className="size-1.5 rounded-full bg-red-500" />
              Live
            </span>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
      </div>
    </div>
  );
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const filter = isFilter(params.filter) ? params.filter : undefined;
  const sort = isSort(params.sort) ? params.sort : "newest";
  const search = params.q?.trim() || undefined;

  const [stats, { users, total }] = await Promise.all([
    getUserListStats(supabaseAdmin),
    listUsers(supabaseAdmin, { search, filter, sort }, page, PAGE_SIZE),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = !!(search || filter);

  const pageHref = (target: number) => {
    const next = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    next.set("page", String(target));
    return `/users?${next}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Everyone with a StreamWizard account. Open one for plans, EventSub, tickets and activity." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Users" value={stats.total} icon={Users} />
        <StatCard title="With a plan" value={stats.paying} icon={CreditCard} />
        <StatCard title="Admins" value={stats.admins} icon={ShieldCheck} />
        <StatCard title="Discord linked" value={stats.discordLinked} />
      </div>

      <TicketFiltersForm action="/users" className="flex flex-wrap items-center gap-2 [&_[data-slot=native-select-wrapper]]:w-full sm:[&_[data-slot=native-select-wrapper]]:w-auto">
        <Input
          name="q"
          defaultValue={params.q}
          placeholder="Name, email, Twitch or Discord name, or any id"
          aria-label="Search users"
          className="min-w-64 flex-1"
        />
        <NativeSelect name="filter" defaultValue={filter ?? ""} aria-label="Filter" className="w-full sm:w-44">
          <NativeSelectOption value="">Everyone</NativeSelectOption>
          {Object.entries(FILTERS).map(([value, label]) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="sort" defaultValue={sort === "newest" ? "" : sort} aria-label="Sort" className="w-full sm:w-40">
          {Object.entries(SORTS).map(([value, label]) => (
            <NativeSelectOption key={value} value={value === "newest" ? "" : value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" size="sm" variant="secondary">
          Search
        </Button>
        {filtered && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/users">Clear</Link>
          </Button>
        )}
      </TicketFiltersForm>

      {users.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">{filtered ? <SearchX /> : <Users />}</EmptyMedia>
            <EmptyTitle>{filtered ? "No users match" : "No users yet"}</EmptyTitle>
            <EmptyDescription>
              {filtered ? "Try a shorter search or another filter." : "Accounts show up here after their first sign-in."}
            </EmptyDescription>
          </EmptyHeader>
          {filtered && (
            <EmptyContent>
              <Button variant="outline" size="sm" asChild>
                <Link href="/users">Clear search</Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <Card className="py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4 text-xs text-muted-foreground">User</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Plans</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Discord</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Role</TableHead>
                  <TableHead className="pr-4 text-right text-xs text-muted-foreground">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="relative has-[a:focus-visible]:bg-muted/50">
                    <TableCell className="max-w-80 py-2.5 pl-4">
                      <UserCell user={user} />
                    </TableCell>
                    <TableCell className="py-2.5">
                      {user.plans.length ? (
                        <div className="flex flex-wrap gap-1">
                          {user.plans.map((plan) => (
                            <Badge key={`${plan.productId}-${plan.planName}`} variant={planStatusVariant(plan.status)} className="text-xs">
                              {plan.planName}
                              {plan.status !== "active" && ` · ${PLAN_STATUS_LABELS[plan.status] ?? plan.status}`}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60">–</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-44 truncate py-2.5">
                      {user.discord ? user.discord.username : <span className="text-muted-foreground/60">–</span>}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {user.roles.includes("admin") ? (
                        <Badge variant="outline" className="text-xs">
                          Admin
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/60">–</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 pr-4 text-right text-muted-foreground">
                      <time dateTime={user.createdAt} title={formatDateTime(user.createdAt)} className="whitespace-nowrap tabular-nums">
                        {formatRelativeTime(user.createdAt)}
                      </time>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {users.length > 0 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground tabular-nums">
            {total} user{total === 1 ? "" : "s"}
            {pages > 1 && ` · page ${page} of ${pages}`}
          </span>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild={page > 1} disabled={page <= 1}>
                {page > 1 ? <Link href={pageHref(page - 1)}>Previous</Link> : <span>Previous</span>}
              </Button>
              <Button variant="outline" size="sm" asChild={page < pages} disabled={page >= pages}>
                {page < pages ? <Link href={pageHref(page + 1)}>Next</Link> : <span>Next</span>}
              </Button>
            </div>
          )}
        </nav>
      )}
    </div>
  );
}
