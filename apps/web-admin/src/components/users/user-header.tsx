import { ExternalLink } from "lucide-react";
import type { AdminUserDetail } from "@repo/supabase/queries/admin-users";
import { Avatar, AvatarFallback, AvatarImage, Badge, Button } from "@repo/ui";
import { formatDateTime, formatRelativeTime } from "@/lib/discord/tickets";
import { userAvatarUrl, userDisplayName } from "@/lib/users";
import { CopyIdsMenu } from "./copy-ids-menu";
import { CopyValue } from "./copy-value";
import { UserActionsMenu } from "./user-actions-menu";

/**
 * Who this is, and everything you can do to them. Needs a GrantAccessProvider
 * above it for the menu's Grant access.
 *
 * The wide layout starts at 1024px, not 768px: with the sidebar open a 768px
 * screen leaves the page about 460px, which is phone territory.
 */
export function UserHeader({
  user,
  isSelf,
  banned,
  discordBanned,
}: {
  user: AdminUserDetail;
  /** The admin looking at the page is this user. */
  isSelf: boolean;
  banned: boolean;
  discordBanned: boolean;
}) {
  const name = userDisplayName(user);
  const avatar = userAvatarUrl(user);
  const ids = [
    { label: "User", value: user.id },
    ...(user.twitch ? [{ label: "Twitch", value: user.twitch.userId }] : []),
    ...(user.discord ? [{ label: "Discord", value: user.discord.userId }] : []),
  ];

  const links = (
    <>
      {user.twitch && (
        <Button variant="outline" size="sm" className="h-11 md:h-8" asChild>
          <a href={`https://twitch.tv/${user.twitch.username}`} target="_blank" rel="noreferrer">
            Twitch
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </Button>
      )}
      {user.discord && (
        <Button variant="outline" size="sm" className="h-11 md:h-8" asChild>
          <a href={`https://discord.com/users/${user.discord.userId}`} target="_blank" rel="noreferrer">
            Discord
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </Button>
      )}
    </>
  );

  // The exact join time is a row on the Account card; the title is a desktop shortcut to it.
  const contact = (
    <p className="text-sm [overflow-wrap:anywhere] text-muted-foreground">
      {user.email} · joined{" "}
      <time dateTime={user.createdAt} title={formatDateTime(user.createdAt)}>
        {formatRelativeTime(user.createdAt)}
      </time>
    </p>
  );

  return (
    <header className="space-y-3">
      <div className="flex items-start gap-3 lg:gap-4">
        <Avatar className="size-10 lg:size-14">
          {avatar && <AvatarImage src={avatar} alt="" />}
          <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1 lg:space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="max-w-full truncate text-lg font-semibold lg:text-xl">{name}</h1>
            {user.roles.includes("admin") && <Badge variant="outline">Admin</Badge>}
            {banned && <Badge variant="destructive">Banned</Badge>}
            {user.live?.isLive && (
              <Badge variant="destructive" className="gap-1.5">
                <span aria-hidden className="size-1.5 rounded-full bg-current" />
                Live
              </Badge>
            )}
            {user.twitch?.broadcasterType && <Badge variant="secondary">{user.twitch.broadcasterType}</Badge>}
          </div>
          <div className="hidden lg:block">{contact}</div>
          <div className="hidden flex-wrap gap-x-4 gap-y-1 lg:flex">
            {ids.map((id) => (
              <CopyValue key={id.label} label={id.label} value={id.value} />
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 lg:flex">{links}</div>
          <UserActionsMenu
            user={{ id: user.id, name, email: user.email, avatar_url: avatar }}
            isSelf={isSelf}
            isAdmin={user.roles.includes("admin")}
            banned={banned}
            discordBanned={discordBanned}
            hasDiscord={!!user.discord}
            hasTwitch={!!user.twitch}
          />
        </div>
      </div>
      {/* Below 1024px the email gets the full width, the three ids fold into one menu and the outside links drop under the name. */}
      <div className="lg:hidden">{contact}</div>
      <div className="flex flex-wrap gap-2 lg:hidden">
        <CopyIdsMenu ids={ids} className="h-11 md:h-8" />
        {links}
      </div>
    </header>
  );
}
