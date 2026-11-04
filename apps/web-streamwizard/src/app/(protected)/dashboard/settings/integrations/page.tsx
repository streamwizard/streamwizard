import { getAuthContext } from "@/lib/auth";
import { getDiscordIntegrationByUserId, getTwitchUsernameByUserId } from "@repo/supabase/queries/users/user";
import { DiscordIntegrationSection } from "@/components/settings/discord-integration-section";
import { TwitchIntegrationSection } from "@/components/settings/twitch-integration-section";

export default async function IntegrationsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ discordRole?: string }>;
}) {
  const [{ supabase, user }, { discordRole }] = await Promise.all([getAuthContext(), searchParams]);

  const [twitchUsername, { data: discord }] = await Promise.all([
    getTwitchUsernameByUserId(supabase, user.id),
    getDiscordIntegrationByUserId(supabase, user.id),
  ]);

  return (
    <div className="w-full max-w-2xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground">Where StreamWizard plugs into the rest of your stack.</p>
      </div>

      <TwitchIntegrationSection twitchUsername={twitchUsername} />
      <DiscordIntegrationSection
        discordUsername={discord?.discord_username ?? null}
        roleStatus={
          discordRole === "pending_membership" || discordRole === "failed" || discordRole === "unlink_blocked"
            ? discordRole
            : null
        }
      />
    </div>
  );
}
