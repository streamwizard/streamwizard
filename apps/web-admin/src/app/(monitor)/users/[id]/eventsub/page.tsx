import { reportError } from "@repo/sentry";
import {
  Badge,
  Card,
  CardContent,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import { ResyncEventSubButton } from "@/components/users/user-actions";
import { formatDateTime, formatRelativeTime } from "@/lib/discord/tickets";
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
            <Badge key={key} variant="outline" title={STATE[key].hint} className={cn("gap-1.5 tabular-nums", diff.counts[key] > 0 && STATE[key].className)}>
              {STATE[key].label} {diff.counts[key]}
            </Badge>
          ))}
          <span className="text-xs text-muted-foreground">Read from Twitch {formatRelativeTime(state.fetchedAt)}</span>
        </div>
        <ResyncEventSubButton userId={user.id} disabled={needsFix === 0} />
      </div>

      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 text-xs text-muted-foreground">Type</TableHead>
                <TableHead className="text-xs text-muted-foreground">Transport</TableHead>
                <TableHead className="text-xs text-muted-foreground">State</TableHead>
                <TableHead className="text-xs text-muted-foreground">Twitch status</TableHead>
                <TableHead className="pr-4 text-right text-xs text-muted-foreground">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diff.rows.map((row, index) => (
                <TableRow key={row.id ?? `${row.type}-${row.transport}-${index}`}>
                  <TableCell className="py-2 pl-4 font-mono text-xs">
                    {row.type} <span className="text-muted-foreground">v{row.version}</span>
                  </TableCell>
                  <TableCell className="py-2 text-sm">{row.transport}</TableCell>
                  <TableCell className={cn("py-2 text-sm font-medium", STATE[row.state].className)} title={STATE[row.state].hint}>
                    {STATE[row.state].label}
                  </TableCell>
                  <TableCell className="py-2 font-mono text-xs text-muted-foreground">{row.status ?? "–"}</TableCell>
                  <TableCell className="py-2 pr-4 text-right text-sm text-muted-foreground">
                    {row.createdAt ? (
                      <time dateTime={row.createdAt} title={formatDateTime(row.createdAt)}>
                        {formatRelativeTime(row.createdAt)}
                      </time>
                    ) : (
                      "–"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Expected list follows the token&apos;s scopes: types that need a scope the user never granted are left out, not missing.
      </p>
    </div>
  );
}
