import Link from "next/link";
import { CreditCard, Search, SearchX, ShieldCheck, Users } from "lucide-react";
import type { UserListFilter, UserListRow, UserListSort, UserListStats } from "@repo/supabase/queries/admin-users";
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
} from "@repo/ui";
import { TicketFiltersForm } from "@/components/discord/ticket-filters-form";
import type { ProductWithPlans } from "@/components/subscriptions/types";
import { DataList, type DataColumn } from "@/components/widgets/data-list";
import { FilterPanel } from "@/components/widgets/filter-panel";
import { PageHeader } from "@/components/widgets/page-header";
import { StatCard } from "@/components/widgets/stat-card";
import { StatGrid } from "@/components/widgets/stat-grid";
import { formatDateTime, formatRelativeTime } from "@/lib/discord/tickets";
import { PLAN_STATUS_LABELS, planStatusVariant, userAvatarUrl, userDisplayName } from "@/lib/users";
import { GrantAccessProvider } from "./grant-access";
import { UserRowMenu } from "./user-row-menu";

export const USER_FILTERS: Record<UserListFilter, string> = {
  paying: "Has a plan",
  admin: "Admins",
  discord: "Discord linked",
  no_twitch: "No Twitch",
};

export const USER_SORTS: Record<UserListSort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  name: "Name",
};

const SELECT = "h-11 text-base md:h-9 md:text-sm";
// DataList is a container: these follow the list's own width, like its table/card switch at @2xl.
const WIDE_ONLY = "hidden @4xl:table-cell";
const NONE = <span className="text-muted-foreground/60 @max-2xl:hidden">–</span>;

// DataList wraps the title cell in the row's link, so this is spans all the way down.
function UserCell({ user }: { user: UserListRow }) {
  const name = userDisplayName(user);
  const avatar = userAvatarUrl(user);
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar className="size-8">
        {avatar && <AvatarImage src={avatar} alt="" />}
        <AvatarFallback className="text-xs">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate">{name}</span>
          {user.isLive && (
            <span className="inline-flex items-center gap-1 text-xs font-normal text-red-600 dark:text-red-400">
              <span aria-hidden className="size-1.5 rounded-full bg-red-500" />
              Live
            </span>
          )}
        </span>
        <span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span>
      </span>
    </span>
  );
}

const COLUMNS: DataColumn<UserListRow>[] = [
  { key: "user", header: "User", mobile: "title", className: "max-w-56 @4xl:max-w-80", cell: (user) => <UserCell user={user} /> },
  {
    key: "plans",
    header: "Plans",
    mobile: "badge",
    cell: (user) =>
      user.plans.length ? (
        // Capped on the card so two plan badges wrap instead of squeezing the name out.
        <span className="flex flex-wrap gap-1 @max-2xl:max-w-40 @max-2xl:justify-end">
          {user.plans.map((plan) => (
            <Badge key={`${plan.productId}-${plan.planName}`} variant={planStatusVariant(plan.status)} className="text-xs">
              {plan.planName}
              {plan.status !== "active" && ` · ${PLAN_STATUS_LABELS[plan.status] ?? plan.status}`}
            </Badge>
          ))}
        </span>
      ) : (
        NONE
      ),
  },
  {
    key: "role",
    header: "Role",
    mobile: "badge",
    cell: (user) =>
      user.roles.includes("admin") ? (
        <Badge variant="outline" className="text-xs">
          Admin
        </Badge>
      ) : (
        NONE
      ),
  },
  {
    key: "discord",
    header: "Discord",
    // Leaves the table while the list is under 896px wide. The card and the user's page still show it.
    headClassName: WIDE_ONLY,
    className: `${WIDE_ONLY} max-w-44 truncate`,
    cell: (user) => (user.discord ? user.discord.username : <span className="text-muted-foreground/60">Not linked</span>),
  },
  {
    key: "joined",
    header: "Joined",
    headClassName: "text-right",
    className: "text-right text-muted-foreground",
    // The exact time is on the user's page; the title is a desktop shortcut to it.
    cell: (user) => (
      <time dateTime={user.createdAt} title={formatDateTime(user.createdAt)} className="whitespace-nowrap tabular-nums">
        {formatRelativeTime(user.createdAt)}
      </time>
    ),
  },
];

export interface UsersViewProps {
  stats: UserListStats;
  users: UserListRow[];
  total: number;
  page: number;
  pageSize: number;
  search?: string;
  filter?: UserListFilter;
  sort: UserListSort;
  /** The plan catalog for the row menu's Grant access. */
  products: ProductWithPlans[];
}

/** The users list without its data loading, so it can be drawn with sample rows too. */
export function UsersView({ stats, users, total, page, pageSize, search, filter, sort, products }: UsersViewProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const filtered = !!(search || filter);

  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (filter) next.set("filter", filter);
    if (sort !== "newest") next.set("sort", sort);
    next.set("page", String(target));
    return `/users?${next}`;
  };

  return (
    // A flex column so the stats can sit above the search on a wide screen and below it on a phone.
    <div className="flex flex-col gap-6">
      <PageHeader title="Users" description="Everyone with a StreamWizard account. Open one for plans, EventSub, tickets and activity." />

      <TicketFiltersForm
        action="/users"
        className="flex flex-wrap items-center gap-2 sm:order-2 [&_[data-slot=native-select-wrapper]]:w-full sm:[&_[data-slot=native-select-wrapper]]:w-auto"
      >
        <Input
          name="q"
          defaultValue={search}
          placeholder="Name, email, Twitch, Discord or any id"
          aria-label="Search users"
          className="h-11 basis-full md:h-9 lg:basis-64 lg:flex-1"
        />
        <Button type="submit" variant="secondary" className="h-11 md:h-9">
          <Search aria-hidden />
          Search
        </Button>
        <FilterPanel activeCount={(filter ? 1 : 0) + (sort !== "newest" ? 1 : 0)}>
          <NativeSelect name="filter" defaultValue={filter ?? ""} aria-label="Filter" className={`${SELECT} w-full sm:w-44`}>
            <NativeSelectOption value="">Everyone</NativeSelectOption>
            {Object.entries(USER_FILTERS).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect name="sort" defaultValue={sort === "newest" ? "" : sort} aria-label="Sort" className={`${SELECT} w-full sm:w-40`}>
            {Object.entries(USER_SORTS).map(([value, label]) => (
              <NativeSelectOption key={value} value={value === "newest" ? "" : value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FilterPanel>
        {filtered && (
          <Button variant="ghost" className="h-11 md:h-9" asChild>
            <Link href="/users">Clear</Link>
          </Button>
        )}
      </TicketFiltersForm>

      <StatGrid cols={4} className="sm:order-1">
        <StatCard title="Users" value={stats.total} icon={Users} />
        <StatCard title="With a plan" value={stats.paying} icon={CreditCard} />
        <StatCard title="Admins" value={stats.admins} icon={ShieldCheck} />
        <StatCard title="Discord linked" value={stats.discordLinked} />
      </StatGrid>

      <div className="space-y-4 sm:order-3">
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
                <Button variant="outline" className="h-11 md:h-8" asChild>
                  <Link href="/users">Clear search</Link>
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <GrantAccessProvider products={products}>
            <Card className="py-0">
              <CardContent className="px-0 sm:px-2">
                <DataList
                  rows={users}
                  rowKey={(user) => user.id}
                  rowHref={(user) => `/users/${user.id}`}
                  columns={COLUMNS}
                  actions={(user) => (
                    <UserRowMenu user={{ id: user.id, name: userDisplayName(user), email: user.email, avatar_url: userAvatarUrl(user) }} />
                  )}
                />
              </CardContent>
            </Card>
          </GrantAccessProvider>
        )}

        {users.length > 0 && (
          <nav className="flex flex-wrap items-center justify-between gap-2 text-sm" aria-label="Pagination">
            <span className="text-muted-foreground tabular-nums">
              {total} user{total === 1 ? "" : "s"}
              {pages > 1 && ` · page ${page} of ${pages}`}
            </span>
            {pages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-11 md:h-8" asChild={page > 1} disabled={page <= 1}>
                  {page > 1 ? <Link href={pageHref(page - 1)}>Previous</Link> : <span>Previous</span>}
                </Button>
                <Button variant="outline" size="sm" className="h-11 md:h-8" asChild={page < pages} disabled={page >= pages}>
                  {page < pages ? <Link href={pageHref(page + 1)}>Next</Link> : <span>Next</span>}
                </Button>
              </div>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
