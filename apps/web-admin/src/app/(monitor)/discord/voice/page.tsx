import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  DEFAULT_VOICE_NAME_TEMPLATE,
  getVoiceSettings,
  listVoiceChannels,
  listVoiceHubs,
  listVoiceRenameBlocks,
  VOICE_HUBS_MAX,
  VOICE_NAME_PLACEHOLDERS,
  VOICE_NAME_TEMPLATE_MAX,
  VOICE_STAFF_ROLES_MAX,
  VOICE_USER_LIMIT_MAX,
} from "@repo/supabase/queries/discord-voice";
import { VoiceHubsManager } from "@/components/discord/voice-hubs-manager";
import { VoiceRenameBlocks } from "@/components/discord/voice-rename-blocks";
import { VoiceStaffForm } from "@/components/discord/voice-staff-form";
import { PageHeader } from "@/components/widgets/page-header";
import { getGuildChannels, getGuildRoles, requireDiscordContext } from "@/lib/discord/api";
import { buildNameMap } from "@/lib/discord/names";
import { toChannelOptions, toRoleOptions } from "@/lib/discord/options";

export const dynamic = "force-dynamic";

export default async function DiscordVoicePage() {
  const { guildId } = requireDiscordContext();
  const [hubs, open, settings, channels, roles, renameBlocks] = await Promise.all([
    listVoiceHubs(supabaseAdmin, guildId),
    listVoiceChannels(supabaseAdmin, guildId),
    getVoiceSettings(supabaseAdmin, guildId),
    getGuildChannels(),
    getGuildRoles(),
    listVoiceRenameBlocks(supabaseAdmin, guildId),
  ]);
  const roleOptions = toRoleOptions(roles);
  const staffRoleIds = settings?.staff_role_ids ?? [];

  const openByHub = new Map<string, number>();
  for (const row of open) if (row.hub_id) openByHub.set(row.hub_id, (openByHub.get(row.hub_id) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voice channels"
        description="Join-to-create: members join a lobby and get a voice channel of their own that they lock, rename and hand over with /voice commands."
      />
      <VoiceStaffForm initial={staffRoleIds} roles={roleOptions} limit={VOICE_STAFF_ROLES_MAX} />
      <VoiceHubsManager
        items={hubs.map((hub) => ({
          id: hub.id,
          lobbyChannelId: hub.lobby_channel_id,
          categoryId: hub.category_id,
          nameTemplate: hub.name_template,
          defaultUserLimit: hub.default_user_limit,
          rememberOwnerSettings: hub.remember_owner_settings,
          staffRoleIds: hub.staff_role_ids,
          openChannels: openByHub.get(hub.id) ?? 0,
        }))}
        voiceChannels={toChannelOptions(channels, ["voice"])}
        categories={toChannelOptions(channels, ["category"])}
        roles={roleOptions}
        serverStaffRoleIds={staffRoleIds}
        staffRolesMax={VOICE_STAFF_ROLES_MAX}
        names={Object.fromEntries(buildNameMap(channels, []))}
        limit={VOICE_HUBS_MAX}
        templateMax={VOICE_NAME_TEMPLATE_MAX}
        userLimitMax={VOICE_USER_LIMIT_MAX}
        defaultTemplate={DEFAULT_VOICE_NAME_TEMPLATE}
        placeholders={VOICE_NAME_PLACEHOLDERS}
      />
      <VoiceRenameBlocks
        items={renameBlocks.map((block) => ({
          discordUserId: block.discord_user_id,
          username: block.username,
          blockedByUsername: block.blocked_by_username,
          reason: block.reason,
          createdAt: block.created_at,
        }))}
      />
    </div>
  );
}
