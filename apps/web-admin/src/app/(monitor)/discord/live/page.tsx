import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getGuildSettings } from "@repo/supabase/queries/discord/discord";
import { listDiscordLiveOptIns } from "@repo/supabase/queries/discord/live";
import { listLiveRoleGrants } from "@repo/supabase/queries/discord/live-role";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { LiveForm } from "@/components/discord/live/live-form";
import { LiveUser } from "@/components/discord/live/live-user";
import { OnOff } from "@/components/discord/live/on-off";
import { TwitchLink } from "@/components/discord/live/twitch-link";
import { DataList } from "@/components/shared/data-list";
import { PageHeader } from "@/components/shared/page/page-header";
import { getGuildChannels, getGuildRoles, requireDiscordContext } from "@/lib/discord/api";
import { toChannelOptions, toRoleOptions } from "@/lib/discord/options";
import { formatDateTime } from "@/lib/discord/tickets/tickets";

export const dynamic = "force-dynamic";

export default async function DiscordLivePage() {
  const { guildId } = requireDiscordContext();
  const [settings, channels, roles, optIns, grants] = await Promise.all([
    getGuildSettings(supabaseAdmin, guildId),
    getGuildChannels(),
    getGuildRoles(),
    listDiscordLiveOptIns(supabaseAdmin),
    listLiveRoleGrants(supabaseAdmin),
  ]);

  const optInByDiscordId = new Map(optIns.map((row) => [row.discordUserId, row]));
  const liveNow = grants.map((grant) => ({ ...grant, user: optInByDiscordId.get(grant.discord_user_id) ?? null }));

  return (
    <div className="space-y-6">
      <PageHeader title="Go-live" description="Posts in the server and a role in the member list when a linked streamer goes live on Twitch." />
      <LiveForm
        // Remount after a save so the form's baseline is the fresh server state.
        key={JSON.stringify(settings)}
        initial={{
          liveEnabled: settings?.live_enabled ?? false,
          liveChannelId: settings?.live_channel_id ?? null,
          liveRoleId: settings?.live_role_id ?? null,
        }}
        channels={toChannelOptions(channels, ["text", "announcement"])}
        roles={toRoleOptions(roles)}
        unhoistedRoleIds={roles.filter((role) => !role.hoist).map((role) => role.id)}
      >
        {/* The lists are the form's children so its save bar, which comes last, stays in view while they scroll. */}
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base">Live right now</CardTitle>
            <CardDescription>
              Who holds the live role at the moment. rest-api checks this against Twitch every ten minutes, so a missed offline fixes itself.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            {liveNow.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                {settings?.live_role_id ? "Nobody is live right now." : "Pick a live role above and this fills in as people go live."}
              </p>
            ) : (
              <DataList
                rows={liveNow}
                rowKey={(row) => row.discord_user_id}
                rowHref={(row) => (row.user ? `/users/${row.user.userId}` : undefined)}
                columns={[
                  {
                    key: "user",
                    header: "User",
                    mobile: "title",
                    cell: (row) => <LiveUser name={row.user?.name ?? null} avatarUrl={row.user?.avatarUrl ?? null} />,
                  },
                  {
                    key: "twitch",
                    header: "Twitch",
                    cell: (row) =>
                      row.user?.twitchUsername ? (
                        <TwitchLink username={row.user.twitchUsername} />
                      ) : (
                        <span className="text-muted-foreground">{row.broadcaster_id}</span>
                      ),
                  },
                  {
                    key: "discord",
                    header: "Discord",
                    cell: (row) => (row.user?.discordUsername ? `@${row.user.discordUsername}` : row.discord_user_id),
                  },
                  {
                    key: "since",
                    header: "Since",
                    className: "whitespace-nowrap text-muted-foreground tabular-nums",
                    cell: (row) => formatDateTime(row.granted_at),
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base">Linked users</CardTitle>
            <CardDescription>
              Everyone with Discord linked, and what they&apos;ve switched on in the main app. Both are on by default. {optIns.length} right now.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            {optIns.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nobody yet. Anyone who links Discord in the main app shows up here.</p>
            ) : (
              <DataList
                rows={optIns}
                rowKey={(row) => row.userId}
                rowHref={(row) => `/users/${row.userId}`}
                columns={[
                  { key: "user", header: "User", mobile: "title", cell: (row) => <LiveUser name={row.name} avatarUrl={row.avatarUrl} /> },
                  {
                    key: "twitch",
                    header: "Twitch",
                    cell: (row) =>
                      row.twitchUsername ? <TwitchLink username={row.twitchUsername} /> : <span className="text-muted-foreground">Not linked</span>,
                  },
                  {
                    key: "discord",
                    header: "Discord",
                    cell: (row) => (row.discordUsername ? `@${row.discordUsername}` : row.discordUserId),
                  },
                  { key: "posts", header: "Posts", cell: (row) => <OnOff on={row.livePosts} /> },
                  { key: "role", header: "Role", cell: (row) => <OnOff on={row.liveRole} /> },
                  {
                    key: "last",
                    header: "Last post",
                    className: "whitespace-nowrap text-muted-foreground tabular-nums",
                    cell: (row) => (row.lastPostedAt ? formatDateTime(row.lastPostedAt) : "Never"),
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>
      </LiveForm>
    </div>
  );
}
