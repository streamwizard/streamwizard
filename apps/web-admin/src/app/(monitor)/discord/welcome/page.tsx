import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getGuildSettings } from "@repo/supabase/queries/discord";
import { WelcomeForm } from "@/components/discord/welcome-form";
import { PageHeader } from "@/components/widgets/page-header";
import { getGuild, getGuildChannels, getGuildRoles, requireDiscordContext } from "@/lib/discord/api";
import { toChannelOptions, toRoleOptions } from "@/lib/discord/options";

export const dynamic = "force-dynamic";

export default async function DiscordWelcomePage() {
  const { guildId } = requireDiscordContext();
  const [settings, channels, roles, guild] = await Promise.all([
    getGuildSettings(supabaseAdmin, guildId),
    getGuildChannels(),
    getGuildRoles(),
    getGuild(),
  ]);

  const systemChannel = channels.find((c) => c.id === guild.system_channel_id);

  return (
    <div className="space-y-6">
      <PageHeader title="Welcome" description="Welcome messages and roles for new members." />
      <WelcomeForm
        // Remount after a save so the form's baseline is the fresh server state.
        key={JSON.stringify(settings)}
        initial={{
          welcomeEnabled: settings?.welcome_enabled ?? true,
          welcomeChannelId: settings?.welcome_channel_id ?? null,
          verifiedRoleId: settings?.verified_role_id ?? null,
          joinRoleId: settings?.join_role_id ?? null,
        }}
        channels={toChannelOptions(channels, ["text"])}
        roles={toRoleOptions(roles)}
        systemChannelName={systemChannel ? `#${systemChannel.name}` : null}
      />
    </div>
  );
}
