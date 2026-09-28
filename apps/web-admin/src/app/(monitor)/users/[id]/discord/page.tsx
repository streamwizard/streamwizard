import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getUserDiscordState } from "@repo/supabase/queries/admin-users";
import { Card, CardContent, CardHeader, CardTitle, Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@repo/ui";
import { UnlinkDiscordButton } from "@/components/users/user-actions";
import { getDiscordContext } from "@/lib/discord/api";
import { formatDateTime, formatRelativeTime } from "@/lib/discord/tickets";
import { loadAdminUser, userDisplayName } from "@/lib/users";

export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

function When({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={formatDateTime(iso)}>
      {formatRelativeTime(iso)}
    </time>
  );
}

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
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
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
                <li key={post.id} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{post.title ?? "Untitled stream"}</span>
                    {post.game_name && <span className="block truncate text-xs text-muted-foreground">{post.game_name}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {guildId ? (
                      <a
                        href={`https://discord.com/channels/${guildId}/${post.channel_id}/${post.message_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        <When iso={post.started_at} />
                      </a>
                    ) : (
                      <When iso={post.started_at} />
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
