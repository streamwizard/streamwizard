import type { DiscordMessage } from "@repo/discord-api";
import type { Json } from "@repo/supabase";
import type { TranscriptMessage } from "@/components/discord/ticket-transcript";
import { requireDiscordContext } from "./api";

// Server-only. Reads an open ticket's channel straight from Discord so staff
// can follow the conversation in the dashboard before it's saved on close.

const PREVIEW_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function avatarUrl(author: DiscordMessage["author"]): string {
  if (author.avatar) return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png?size=64`;
  // Default avatar index for accounts on the new username system.
  const index = Number((BigInt(author.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function toTranscriptMessage(message: DiscordMessage): TranscriptMessage {
  return {
    id: message.id,
    author_discord_id: message.author.id,
    author_name: message.author.global_name ?? message.author.username,
    author_avatar_url: avatarUrl(message.author),
    author_is_bot: !!message.author.bot,
    content: message.content,
    embeds: message.embeds as Json,
    attachments: message.attachments.map((a) => {
      const previewable = PREVIEW_TYPES.has(a.content_type?.split(";")[0] ?? "");
      return {
        id: a.id,
        name: a.filename,
        size: a.size,
        content_type: a.content_type ?? null,
        url: previewable ? a.url : null,
        link_url: previewable ? null : a.url,
      };
    }) as unknown as Json,
    created_at: message.timestamp,
    edited_at: message.edited_timestamp,
  };
}

/** Null when the channel is gone. */
export async function getLiveTranscript(channelId: string): Promise<TranscriptMessage[] | null> {
  const messages = await requireDiscordContext().api.guilds.listChannelMessages(channelId);
  return messages ? messages.map(toTranscriptMessage) : null;
}
