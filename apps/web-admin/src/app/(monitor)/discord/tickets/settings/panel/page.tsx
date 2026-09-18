import { parseTicketPanel } from "@repo/discord-message";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getTicketSettings } from "@repo/supabase/queries/tickets";
import { TicketPanelEditor } from "@/components/discord/ticket-panel-editor";
import { getBotProfile, getGuildChannels, requireDiscordContext } from "@/lib/discord/api";
import { bannerUploadsEnabled } from "@/lib/discord/banner-storage";
import { getBuilderThemes } from "@/lib/discord/theme-assets";

export const dynamic = "force-dynamic";

export default async function DiscordTicketPanelPage() {
  const { guildId } = requireDiscordContext();
  const [settings, channels, bot] = await Promise.all([
    getTicketSettings(supabaseAdmin, guildId),
    getGuildChannels(),
    getBotProfile(),
  ]);
  const channel = channels.find((c) => c.id === settings?.panel_channel_id);

  return (
    <TicketPanelEditor
      // A save replaces the stored design: start the editor over from it.
      key={JSON.stringify(settings?.panel ?? null)}
      initial={parseTicketPanel(settings?.panel)}
      postedIn={channel ? `#${channel.name}` : null}
      themes={getBuilderThemes()}
      bot={bot}
      uploadsEnabled={bannerUploadsEnabled()}
    />
  );
}
