import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  DEFAULT_VOICE_NAME_TEMPLATE,
  listVoiceChannels,
  listVoiceHubs,
  VOICE_HUBS_MAX,
  VOICE_NAME_PLACEHOLDERS,
  VOICE_NAME_TEMPLATE_MAX,
  VOICE_USER_LIMIT_MAX,
} from "@repo/supabase/queries/discord-voice";
import { VoiceHubsManager } from "@/components/discord/voice-hubs-manager";
import { PageHeader } from "@/components/widgets/page-header";
import { getGuildChannels, requireDiscordContext } from "@/lib/discord/api";
import { buildNameMap } from "@/lib/discord/names";
import { toChannelOptions } from "@/lib/discord/options";

export const dynamic = "force-dynamic";

export default async function DiscordVoicePage() {
  const { guildId } = requireDiscordContext();
  const [hubs, open, channels] = await Promise.all([
    listVoiceHubs(supabaseAdmin, guildId),
    listVoiceChannels(supabaseAdmin, guildId),
    getGuildChannels(),
  ]);

  const openByHub = new Map<string, number>();
  for (const row of open) if (row.hub_id) openByHub.set(row.hub_id, (openByHub.get(row.hub_id) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voice channels"
        description="Join-to-create: members join a lobby and get a voice channel of their own that they lock, rename and hand over with /voice commands."
      />
      <VoiceHubsManager
        items={hubs.map((hub) => ({
          id: hub.id,
          lobbyChannelId: hub.lobby_channel_id,
          categoryId: hub.category_id,
          nameTemplate: hub.name_template,
          defaultUserLimit: hub.default_user_limit,
          openChannels: openByHub.get(hub.id) ?? 0,
        }))}
        voiceChannels={toChannelOptions(channels, ["voice"])}
        categories={toChannelOptions(channels, ["category"])}
        names={Object.fromEntries(buildNameMap(channels, []))}
        limit={VOICE_HUBS_MAX}
        templateMax={VOICE_NAME_TEMPLATE_MAX}
        userLimitMax={VOICE_USER_LIMIT_MAX}
        defaultTemplate={DEFAULT_VOICE_NAME_TEMPLATE}
        placeholders={VOICE_NAME_PLACEHOLDERS}
      />
    </div>
  );
}
