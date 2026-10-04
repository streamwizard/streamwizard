import Link from "next/link";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { type UserActivitySource, listUserActivity } from "@repo/supabase/queries/admin-users";
import { Button, Card, CardContent, Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@repo/ui";
import { PageTabs } from "@/components/page-tabs";
import { ActivityList } from "@/components/users/activity-list";
import { loadAdminUser } from "@/lib/users";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const SOURCES: Record<UserActivitySource, { label: string; description: string }> = {
  platform: {
    label: "Platform",
    description: "Signups, plan changes, Discord links, clip syncs, tickets and admin actions, from the platform log.",
  },
  system: { label: "System", description: "Backend events for their channel: EventSub setup, token refreshes, sync jobs." },
  stream: { label: "Stream", description: "What happened on stream: follows, subs, raids, cheers and the rest." },
};

const isSource = (value: string | undefined): value is UserActivitySource => !!value && value in SOURCES;

export default async function UserActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string; page?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await loadAdminUser(id);
  const source: UserActivitySource = isSource(query.source) ? query.source : "platform";
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const { rows, total } = await listUserActivity(
    supabaseAdmin,
    source,
    { userId: user.id, twitchUserId: user.twitch?.userId ?? null },
    page,
    PAGE_SIZE,
  );
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (next: { source?: UserActivitySource; page?: number }) => {
    const params = new URLSearchParams();
    const s = next.source ?? source;
    if (s !== "platform") params.set("source", s);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const q = params.toString();
    return `/users/${user.id}/activity${q ? `?${q}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <PageTabs
          label="Activity source"
          variant="pills"
          tabs={(Object.keys(SOURCES) as UserActivitySource[]).map((key) => ({
            href: href({ source: key }),
            label: SOURCES[key].label,
            active: key === source,
          }))}
        />
        <p className="text-sm text-muted-foreground">{SOURCES[source].description}</p>
      </div>

      {rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Nothing here</EmptyTitle>
            <EmptyDescription>
              {source !== "platform" && !user.twitch ? "These events are keyed by Twitch channel, and none is linked." : "No events from this source yet."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="py-0">
          <CardContent className="px-4 py-1">
            <ActivityList rows={rows} />
          </CardContent>
        </Card>
      )}

      {total > 0 && (
        <nav className="flex flex-wrap items-center justify-between gap-2 text-sm" aria-label="Pagination">
          <span className="text-muted-foreground tabular-nums">
            {total} event{total === 1 ? "" : "s"}
            {pages > 1 && ` · page ${page} of ${pages}`}
          </span>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-11 md:h-8" asChild={page > 1} disabled={page <= 1}>
                {page > 1 ? <Link href={href({ page: page - 1 })}>Newer</Link> : <span>Newer</span>}
              </Button>
              <Button variant="outline" size="sm" className="h-11 md:h-8" asChild={page < pages} disabled={page >= pages}>
                {page < pages ? <Link href={href({ page: page + 1 })}>Older</Link> : <span>Older</span>}
              </Button>
            </div>
          )}
        </nav>
      )}
    </div>
  );
}
