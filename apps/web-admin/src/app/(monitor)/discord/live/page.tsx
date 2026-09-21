import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getGuildSettings } from "@repo/supabase/queries/discord";
import { listDiscordLiveOptIns } from "@repo/supabase/queries/discord-live";
import { listLiveRoleGrants } from "@repo/supabase/queries/discord-live-role";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { LiveForm } from "@/components/discord/live-form";
import { PageHeader } from "@/components/widgets/page-header";
import { getGuildChannels, getGuildRoles, requireDiscordContext } from "@/lib/discord/api";
import { toChannelOptions, toRoleOptions } from "@/lib/discord/options";
import { formatDateTime } from "@/lib/discord/tickets";

export const dynamic = "force-dynamic";

function Avatar({ url }: { url: string | null }) {
  if (!url?.startsWith("https://")) return <span className="size-6 shrink-0 rounded-full bg-muted" aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element -- Twitch CDN avatar, same as the log page
  return <img src={url} alt="" className="size-6 shrink-0 rounded-full object-cover" />;
}

function OnOff({ on }: { on: boolean }) {
  return <span className={on ? undefined : "text-muted-foreground"}>{on ? "On" : "Off"}</span>;
}

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
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live right now</CardTitle>
          <CardDescription>
            Who holds the live role at the moment. rest-api checks this against Twitch every ten minutes, so a missed offline fixes itself.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Twitch</TableHead>
                <TableHead>Discord</TableHead>
                <TableHead>Since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liveNow.map((row) => (
                <TableRow key={row.discord_user_id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Avatar url={row.user?.avatarUrl ?? null} />
                      <span className="truncate">{row.user?.name ?? "Unnamed"}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    {row.user?.twitchUsername ? (
                      <a
                        href={`https://twitch.tv/${encodeURIComponent(row.user.twitchUsername)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {row.user.twitchUsername}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">{row.broadcaster_id}</span>
                    )}
                  </TableCell>
                  <TableCell title={row.discord_user_id}>
                    {row.user?.discordUsername ? `@${row.user.discordUsername}` : row.discord_user_id}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{formatDateTime(row.granted_at)}</TableCell>
                </TableRow>
              ))}
              {liveNow.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="p-8 text-center text-muted-foreground">
                    {settings?.live_role_id ? "Nobody is live right now." : "Pick a live role above and this fills in as people go live."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked users</CardTitle>
          <CardDescription>
            Everyone with Discord linked, and what they&apos;ve switched on in the main app. Both are on by default. {optIns.length} right now.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Twitch</TableHead>
                <TableHead>Discord</TableHead>
                <TableHead>Posts</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last post</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {optIns.map((row) => (
                <TableRow key={row.userId}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Avatar url={row.avatarUrl} />
                      <span className="truncate">{row.name ?? "Unnamed"}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    {row.twitchUsername ? (
                      <a
                        href={`https://twitch.tv/${encodeURIComponent(row.twitchUsername)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {row.twitchUsername}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Not linked</span>
                    )}
                  </TableCell>
                  <TableCell title={row.discordUserId}>{row.discordUsername ? `@${row.discordUsername}` : row.discordUserId}</TableCell>
                  <TableCell>
                    <OnOff on={row.livePosts} />
                  </TableCell>
                  <TableCell>
                    <OnOff on={row.liveRole} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                    {row.lastPostedAt ? formatDateTime(row.lastPostedAt) : "Never"}
                  </TableCell>
                </TableRow>
              ))}
              {optIns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="p-8 text-center text-muted-foreground">
                    Nobody yet. Anyone who links Discord in the main app shows up here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
