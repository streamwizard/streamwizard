import { MessageSquareDashed } from "lucide-react";
import { parseBuiltMessage } from "@repo/discord-message";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listBuiltMessages, type DiscordBuiltMessage } from "@repo/supabase/queries/discord-built-messages";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@repo/ui";
import { BuiltMessageList, type BuiltMessageListItem } from "@/components/discord/built-message-list";
import { NewBuiltMessageButton } from "@/components/discord/built-message-new";
import { PageHeader } from "@/components/widgets/page-header";
import { getGuildChannels, requireDiscordContext } from "@/lib/discord/api";
import { builtMessageStatus, channelNameFor } from "@/lib/discord/built-messages";
import { formatDateTime } from "@/lib/discord/tickets";

export const dynamic = "force-dynamic";

function channelLabel(row: DiscordBuiltMessage, names: Map<string, string>): string {
  if (row.draft_create_channel) return `#${channelNameFor(row.name)} (created on publish)`;
  const id = row.draft_channel_id ?? row.channel_id;
  if (!id) return "No channel yet";
  const name = names.get(id);
  return name ? `#${name}` : "Deleted channel";
}

export default async function DiscordMessagesPage() {
  const { guildId } = requireDiscordContext();
  const [rows, channels] = await Promise.all([listBuiltMessages(supabaseAdmin, guildId), getGuildChannels()]);
  const names = new Map(channels.map((c) => [c.id, c.name]));

  const messages: BuiltMessageListItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    channel: channelLabel(row, names),
    status: builtMessageStatus({
      draft: parseBuiltMessage(row.draft),
      published: parseBuiltMessage(row.published),
      draftChannelId: row.draft_channel_id,
      createChannel: row.draft_create_channel,
      channelId: row.channel_id,
    }),
    publishedAt: row.published_at ? formatDateTime(row.published_at) : null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="Build a message with banners and embeds, pick any channel, publish. Rules, welcome, links, whatever the server needs."
      >
        {messages.length > 0 && <NewBuiltMessageButton />}
      </PageHeader>

      {messages.length > 0 ? (
        <BuiltMessageList messages={messages} />
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquareDashed />
            </EmptyMedia>
            <EmptyTitle>No messages yet</EmptyTitle>
            <EmptyDescription>Start from a template or a blank embed. Nothing is sent until you publish.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <NewBuiltMessageButton />
          </EmptyContent>
        </Empty>
      )}
    </div>
  );
}
