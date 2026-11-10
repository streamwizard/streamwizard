import { notFound } from "next/navigation";
import { MESSAGE_TEMPLATES, parseBuiltMessage } from "@repo/discord-message";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getBuiltMessage } from "@repo/supabase/queries/discord/built-messages";
import { BuiltMessageEditor } from "@/components/discord/messages/built-message-editor";
import { getBotProfile, getGuildChannels, requireDiscordContext } from "@/lib/discord/api";
import { bannerUploadsEnabled } from "@/lib/discord/messages/banner-storage";
import { MESSAGE_CHANNEL_KINDS } from "@/lib/discord/messages/built-messages";
import { toChannelOptions } from "@/lib/discord/options";
import { getBuilderThemes } from "@/lib/discord/messages/theme-assets";
import { PageCrumb } from "@/lib/nav/crumbs";
import { isGuid } from "@repo/schemas/ids";

export const dynamic = "force-dynamic";


export default async function DiscordMessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isGuid(id)) notFound();

  const { guildId } = requireDiscordContext();
  const [row, channels, bot] = await Promise.all([
    getBuiltMessage(supabaseAdmin, guildId, id),
    getGuildChannels(),
    getBotProfile(),
  ]);
  if (!row) notFound();

  return (
    <>
      <PageCrumb label={row.name?.trim() || "Message"} href={`/discord/messages/${row.id}`} />
      <BuiltMessageEditor
        // A different message is a different editor: no draft or autosave state carries over.
        key={row.id}
        id={row.id}
        initial={{
          name: row.name,
          // A stored draft from an older shape falls back to a blank message rather than a broken page.
          message: parseBuiltMessage(row.draft) ?? MESSAGE_TEMPLATES[0]!.create(),
          channelId: row.draft_channel_id,
          createChannel: row.draft_create_channel,
        }}
        published={{ message: parseBuiltMessage(row.published), channelId: row.channel_id }}
        channels={toChannelOptions(channels, MESSAGE_CHANNEL_KINDS)}
        themes={getBuilderThemes()}
        bot={bot}
        uploadsEnabled={bannerUploadsEnabled()}
      />
    </>
  );
}
