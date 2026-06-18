import { getAuthContext } from "@/lib/auth";
import { getDiscordIntegrationByUserId } from "@repo/supabase/queries/user";
import { DiscordIntegrationSection } from "@/components/settings/discord-integration-section";
import { TwitchIntegrationSection } from "@/components/settings/twitch-integration-section";

export default async function IntegrationsSettingsPage() {
  const { supabase, user } = await getAuthContext();

  const { data: twitch } = await supabase
    .from("integrations_twitch")
    .select("twitch_username")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: discord } = await getDiscordIntegrationByUserId(supabase, user.id);

  return (
    <div className="w-full max-w-2xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground">Where StreamWizard plugs into the rest of your stack.</p>
      </div>

      <TwitchIntegrationSection twitchUsername={twitch?.twitch_username ?? null} />
      <DiscordIntegrationSection discordUsername={discord?.discord_username ?? null} />
    </div>
  );
}
