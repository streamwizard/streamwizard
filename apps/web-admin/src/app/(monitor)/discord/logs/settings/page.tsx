import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getLogRouting, resolveLogRoute } from "@repo/supabase/queries/platform-events";
import { PLATFORM_EVENT_TYPES } from "@repo/types";
import { LogSettingsForm } from "@/components/discord/log-settings-form";
import { PageHeader } from "@/components/widgets/page-header";
import { getGuildChannels, requireDiscordContext } from "@/lib/discord/api";
import { toChannelOptions } from "@/lib/discord/options";

export const dynamic = "force-dynamic";

export default async function DiscordLogSettingsPage() {
  const { guildId } = requireDiscordContext();
  const [routing, channels] = await Promise.all([getLogRouting(supabaseAdmin, guildId), getGuildChannels()]);

  // Every type with its effective state, so the form shows defaults too.
  const initial = {
    defaultChannelId: routing.defaultChannelId,
    ignoredChannelIds: routing.ignoredChannelIds,
    events: Object.fromEntries(
      PLATFORM_EVENT_TYPES.map((type) => [
        type,
        { enabled: resolveLogRoute(routing, type).enabled, channelId: routing.events[type]?.channelId ?? null },
      ])
    ),
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Log routing" description="Which events get posted, and to which channel." />
      <LogSettingsForm
        key={JSON.stringify(routing)}
        initial={initial}
        textChannels={toChannelOptions(channels, ["text"])}
        ignorableChannels={toChannelOptions(channels, ["text", "voice", "category"])}
      />
    </div>
  );
}
