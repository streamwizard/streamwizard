import Link from "next/link";
import { ArrowLeft, Ban, ExternalLink } from "lucide-react";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getTwitchUsernames } from "@repo/supabase/queries/platform-events";
import { Alert, AlertDescription, AlertTitle, Avatar, AvatarFallback, AvatarImage, Badge, Button } from "@repo/ui";
import { CopyValue } from "@/components/users/copy-value";
import { UnbanButton } from "@/components/users/moderation";
import { UserTabs } from "@/components/users/user-tabs";
import { formatDateTime, formatRelativeTime } from "@/lib/discord/tickets";
import { loadUserAuthState } from "@/lib/user-auth";
import { LIVE_PLAN_STATUSES, loadAdminUser, userAvatarUrl, userDisplayName } from "@/lib/users";

export default async function UserLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await loadAdminUser(id);
  const auth = await loadUserAuthState(user.id);
  const banner = auth?.ban ? (await getTwitchUsernames(supabaseAdmin, [auth.ban.by])).get(auth.ban.by) : null;
  const name = userDisplayName(user);
  const avatar = userAvatarUrl(user);
  const livePlans = user.subscriptions.filter((sub) => LIVE_PLAN_STATUSES.has(sub.status)).length;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
        <Link href="/users">
          <ArrowLeft className="size-4" aria-hidden />
          Users
        </Link>
      </Button>

      <header className="flex flex-wrap items-start gap-4">
        <Avatar className="size-14">
          {avatar && <AvatarImage src={avatar} alt="" />}
          <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold">{name}</h1>
            {user.roles.includes("admin") && <Badge variant="outline">Admin</Badge>}
            {auth?.bannedUntil && <Badge variant="destructive">Banned</Badge>}
            {user.live?.isLive && (
              <Badge variant="destructive" className="gap-1.5">
                <span aria-hidden className="size-1.5 rounded-full bg-current" />
                Live
              </Badge>
            )}
            {user.twitch?.broadcasterType && <Badge variant="secondary">{user.twitch.broadcasterType}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {user.email} · joined{" "}
            <time dateTime={user.createdAt} title={formatDateTime(user.createdAt)}>
              {formatRelativeTime(user.createdAt)}
            </time>
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <CopyValue label="User" value={user.id} />
            {user.twitch && <CopyValue label="Twitch" value={user.twitch.userId} />}
            {user.discord && <CopyValue label="Discord" value={user.discord.userId} />}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.twitch && (
            <Button variant="outline" size="sm" asChild>
              <a href={`https://twitch.tv/${user.twitch.username}`} target="_blank" rel="noreferrer">
                Twitch
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </Button>
          )}
          {user.discord && (
            <Button variant="outline" size="sm" asChild>
              <a href={`https://discord.com/users/${user.discord.userId}`} target="_blank" rel="noreferrer">
                Discord
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </Button>
          )}
        </div>
      </header>

      {auth?.bannedUntil && (
        <Alert variant="destructive">
          <Ban aria-hidden />
          <AlertTitle>Banned</AlertTitle>
          <AlertDescription>
            <p>
              {auth.ban ? (
                <>
                  {banner ? `${banner} banned them` : "Banned"}{" "}
                  {auth.ban.at && (
                    <time dateTime={auth.ban.at} title={formatDateTime(auth.ban.at)}>
                      {formatRelativeTime(auth.ban.at)}
                    </time>
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

      <UserTabs
        userId={user.id}
        tabs={[
          { segment: "", label: "Overview" },
          { segment: "subscriptions", label: "Plans", count: livePlans },
          { segment: "eventsub", label: "EventSub" },
          { segment: "tickets", label: "Tickets" },
          { segment: "discord", label: "Discord" },
          { segment: "activity", label: "Activity" },
        ]}
      />

      {children}
    </div>
  );
}
