import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getActivitySettings, getIgnoredChannelIds } from "@repo/supabase/queries/discord-activity";
import { ActivityForm } from "@/components/discord/activity-form";
import { PageHeader } from "@/components/widgets/page-header";
import { getGuildChannels, requireDiscordContext } from "@/lib/discord/api";
import { toChannelOptions } from "@/lib/discord/options";

export const dynamic = "force-dynamic";

export default async function DiscordActivityPage() {
  const { guildId } = requireDiscordContext();
  const [settings, ignored, channels] = await Promise.all([
    getActivitySettings(supabaseAdmin, guildId),
    getIgnoredChannelIds(supabaseAdmin, guildId),
    getGuildChannels(),
  ]);

  // No row means the bot runs on its defaults: everything on.
  const initial = {
    trackingEnabled: settings?.tracking_enabled ?? true,
    trackMessages: settings?.track_messages ?? true,
    trackReactions: settings?.track_reactions ?? true,
    trackVoice: settings?.track_voice ?? true,
    voiceIgnoreAfk: settings?.voice_ignore_afk ?? true,
    voiceRequireOthers: settings?.voice_require_others ?? true,
    ignoredChannelIds: ignored,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Activity" description="What the bot counts for ranks and leaderboards." />
      <ActivityForm key={JSON.stringify(initial)} initial={initial} channels={toChannelOptions(channels, ["text", "voice", "category"])} />
    </div>
  );
}
