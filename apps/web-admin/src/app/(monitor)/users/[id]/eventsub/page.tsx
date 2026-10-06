import { reportError } from "@repo/sentry";
import { Badge, Card, CardContent, Empty, EmptyDescription, EmptyHeader, EmptyTitle, Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import { When } from "@/components/users/detail";
import { ResyncEventSubButton } from "@/components/users/user-actions";
import { DataList } from "@/components/widgets/data-list";
import { formatRelativeTime } from "@/lib/discord/tickets";
import type { UserSubscriptionState } from "@/lib/user-eventsub";
import { loadUserEventSub, type UserEventSubState } from "@/lib/user-eventsub-server";
import { loadAdminUser } from "@/lib/users";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATE: Record<UserSubscriptionState, { label: string; hint: string; className: string }> = {
  ok: { label: "OK", hint: "Expected and live on Twitch.", className: "text-emerald-600 dark:text-emerald-400" },
  missing: { label: "Missing", hint: "Expected but not on Twitch. A resync creates it.", className: "text-red-600 dark:text-red-400" },
  failed: { label: "Failed", hint: "On Twitch but no longer delivering. A resync deletes it.", className: "text-red-600 dark:text-red-400" },
  extra: {
    label: "Extra",
    hint: "Live on Twitch but not expected: an old version, another transport or a second copy. Left alone.",
    className: "text-amber-600 dark:text-amber-400",
  },
};

function Message({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export default async function UserEventSubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await loadAdminUser(id);
  if (!user.twitch) return <Message title="No Twitch account" description="EventSub subscriptions hang off the Twitch channel." />;

  let state: UserEventSubState;
  try {
    state = await loadUserEventSub(user.twitch.userId, user.twitch.scopes);
  } catch (error) {
    reportError(error, "users/eventsub: load");
    return <Message title="Couldn't reach Twitch" description="Get EventSub Subscriptions failed. Reload to try again." />;
  }
  if (!state.configured) return <Message title="Twitch isn't configured" description={state.reason} />;

  const { diff } = state;
  const needsFix = diff.counts.missing + diff.counts.failed;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {(Object.keys(STATE) as UserSubscriptionState[]).map((key) => (
            // Each count explains itself on a tap; the meaning used to sit in a hover title.
            <Popover key={key}>
              <PopoverTrigger
                aria-label={`${STATE[key].label}: ${diff.counts[key]}. What this means`}
                className="-my-2 cursor-pointer rounded-md py-2 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Badge variant="outline" className={cn("gap-1.5 tabular-nums", diff.counts[key] > 0 && STATE[key].className)}>
                  {STATE[key].label} {diff.counts[key]}
                </Badge>
              </PopoverTrigger>
              <PopoverContent className="w-64 text-sm">{STATE[key].hint}</PopoverContent>
            </Popover>
          ))}
          <span className="text-xs text-muted-foreground">Read from Twitch {formatRelativeTime(state.fetchedAt)}</span>
        </div>
        <ResyncEventSubButton userId={user.id} disabled={needsFix === 0} />
      </div>
      {needsFix === 0 && <p className="text-xs text-muted-foreground">Nothing is missing or failed, so there&apos;s nothing to resync.</p>}

      <Card className="py-0">
        <CardContent className="px-0 sm:px-2">
          <DataList
            rows={diff.rows.map((row, index) => ({ ...row, key: row.id ?? `${row.type}-${row.transport}-${index}` }))}
            rowKey={(row) => row.key}
            columns={[
              {
                key: "type",
                header: "Type",
                mobile: "title",
                className: "font-mono text-xs",
                cell: (row) => (
                  <span className="font-mono text-xs break-all">
                    {row.type} <span className="text-muted-foreground">v{row.version}</span>
                  </span>
                ),
              },
              { key: "transport", header: "Transport", cell: (row) => row.transport },
              {
                key: "state",
                header: "State",
                mobile: "badge",
                cell: (row) => <span className={cn("text-sm font-medium", STATE[row.state].className)}>{STATE[row.state].label}</span>,
              },
              {
                key: "status",
                header: "Twitch status",
                cell: (row) => <span className="font-mono text-xs break-all text-muted-foreground">{row.status ?? "–"}</span>,
              },
              {
                key: "created",
                header: "Created",
                headClassName: "text-right",
                className: "text-right text-muted-foreground",
                cell: (row) => (row.createdAt ? <When iso={row.createdAt} /> : "–"),
              },
            ]}
          />
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Expected list follows the token&apos;s scopes: types that need a scope the user never granted are left out, not missing.
      </p>
    </div>
  );
}
