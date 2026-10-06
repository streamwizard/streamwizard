import { ExternalLink } from "lucide-react";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getUserDiscordState } from "@repo/supabase/queries/admin-users";
import { Card, CardContent, CardHeader, CardTitle, Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@repo/ui";
import { Row, When } from "@/components/users/detail";
import { UnlinkDiscordButton } from "@/components/users/user-actions";
import { getDiscordContext } from "@/lib/discord/api";
import { formatDateTimeShort } from "@/lib/discord/tickets";
import { loadAdminUser, userDisplayName } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function UserDiscordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await loadAdminUser(id);

  if (!user.discord) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Discord not linked</EmptyTitle>
          <EmptyDescription>They can link it from Settings → Integrations in the dashboard.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const guildId = getDiscordContext()?.guildId ?? null;
  const state = await getUserDiscordState(supabaseAdmin, user.id, user.discord.userId, guildId);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Linked account</CardTitle>
          <UnlinkDiscordButton userId={user.id} name={userDisplayName(user)} />
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <Row label="Username">{user.discord.username}</Row>
            <Row label="Linked">
              <When iso={user.discord.linkedAt} />
            </Row>
            <Row label="Server member">
              {!guildId ? (
                <span className="text-muted-foreground">Discord isn&apos;t configured</span>
              ) : state.member ? (
                <span>
                  #{state.member.join_number} · joined <When iso={state.member.joined_at} />
                </span>
              ) : (
                <span className="text-muted-foreground">Not in the server</span>
              )}
            </Row>
            <Row label="Live role">
              {state.liveRole ? (
                <span>
                  Held since <When iso={state.liveRole.granted_at} />
                </span>
              ) : (
                <span className="text-muted-foreground">Not held</span>
              )}
            </Row>
            <Row label="Go-live posts">{user.preferences?.discordLiveNotifications ? "On" : "Off"}</Row>
            <Row label="Live role opt-in">{user.preferences?.discordLiveRole ? "On" : "Off"}</Row>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent go-live posts</CardTitle>
        </CardHeader>
        <CardContent>
          {state.livePosts.length ? (
            <ul className="divide-y">
              {state.livePosts.map((post) => (
                <li key={post.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{post.title ?? "Untitled stream"}</span>
                    {post.game_name && <span className="block truncate text-xs text-muted-foreground">{post.game_name}</span>}
                  </span>
                  {/* The exact start time, in view: these rows are few and a hover title never shows on a phone. */}
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {guildId ? (
                      <a
                        href={`https://discord.com/channels/${guildId}/${post.channel_id}/${post.message_id}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open the post from ${formatDateTimeShort(post.started_at)} in Discord`}
                        className="inline-flex min-h-10 items-center gap-1 underline underline-offset-4 md:min-h-0"
                      >
                        <time dateTime={post.started_at}>{formatDateTimeShort(post.started_at)}</time>
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : (
                      <time dateTime={post.started_at}>{formatDateTimeShort(post.started_at)}</time>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No go-live posts yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
