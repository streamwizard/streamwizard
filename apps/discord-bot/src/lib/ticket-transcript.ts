import { randomUUID } from "node:crypto";
import type { Collection, Message, TextChannel } from "discord.js";
import { R2Storage } from "@repo/storage";
import { supabase } from "@repo/supabase";
import {
  saveTicketTranscript,
  type DiscordTicket,
  type DiscordTicketMessageInsert,
} from "@repo/supabase/queries/tickets";
import { reportError } from "@repo/sentry";
import { env } from "./env";
import { displayNameOf } from "./server-log/refs";

// Saves a ticket channel's messages before the channel is deleted (SW-346).
// Small images are copied to R2 so screenshots survive Discord's expiring CDN
// links; anything bigger, and every non-image file, keeps metadata only to
// keep storage cheap.

const MAX_IMAGE_BYTES = 500 * 1024;
const MAX_IMAGES_PER_TICKET = 20;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

interface StoredAttachment {
  id: string;
  name: string;
  size: number;
  content_type: string | null;
  /** Set only when the file was copied to R2. */
  r2_key: string | null;
  url: string | null;
}

let r2: R2Storage | null | undefined;
function getR2(): R2Storage | null {
  if (r2 === undefined) {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ASSETS_BUCKET, NEXT_PUBLIC_CDN_URL } = env;
    r2 =
      R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ASSETS_BUCKET && NEXT_PUBLIC_CDN_URL
        ? new R2Storage({
            accountId: R2_ACCOUNT_ID,
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
            bucket: R2_ASSETS_BUCKET,
          })
        : null;
  }
  return r2;
}

async function fetchAllMessages(channel: TextChannel): Promise<Message[]> {
  const messages: Message[] = [];
  let before: string | undefined;
  for (;;) {
    const batch: Collection<string, Message> = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;
    messages.push(...batch.values());
    before = batch.last()?.id;
  }
  return messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

async function copyImage(
  ticket: DiscordTicket,
  attachment: Message["attachments"] extends Collection<string, infer A> ? A : never,
) {
  const storage = getR2();
  if (!storage || !env.NEXT_PUBLIC_CDN_URL) return null;

  const response = await fetch(attachment.url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) return null;
  const body = new Uint8Array(await response.arrayBuffer());
  if (body.byteLength > MAX_IMAGE_BYTES) return null;

  // Random segment: the bucket is served publicly, so keys mustn't be guessable.
  const safeName = attachment.name.replace(/[^\w.-]/g, "_").slice(-80);
  const key = `discord-tickets/${ticket.guild_id}/${ticket.id}/${randomUUID()}-${safeName}`;
  await storage.putObject(key, body, attachment.contentType ?? "application/octet-stream");
  return { key, url: `${env.NEXT_PUBLIC_CDN_URL.replace(/\/$/, "")}/${key}` };
}

/** Captures and stores the whole channel. Throws if the transcript can't be saved. */
export async function captureTicketTranscript(channel: TextChannel, ticket: DiscordTicket): Promise<number> {
  const messages = await fetchAllMessages(channel);
  let imagesCopied = 0;

  const rows: DiscordTicketMessageInsert[] = [];
  for (const message of messages) {
    const attachments: StoredAttachment[] = [];
    for (const attachment of message.attachments.values()) {
      let copied: { key: string; url: string } | null = null;
      const isSmallImage =
        IMAGE_TYPES.has(attachment.contentType?.split(";")[0] ?? "") && attachment.size <= MAX_IMAGE_BYTES;
      if (isSmallImage && imagesCopied < MAX_IMAGES_PER_TICKET) {
        // A failed copy only loses the preview, never the transcript.
        copied = await copyImage(ticket, attachment).catch((error) => {
          reportError(error, "discord-bot tickets: copy image", { ticketId: ticket.id, attachmentId: attachment.id });
          return null;
        });
        if (copied) imagesCopied++;
      }
      attachments.push({
        id: attachment.id,
        name: attachment.name,
        size: attachment.size,
        content_type: attachment.contentType,
        r2_key: copied?.key ?? null,
        url: copied?.url ?? null,
      });
    }

    rows.push({
      ticket_id: ticket.id,
      message_id: message.id,
      author_discord_id: message.author.id,
      author_name: displayNameOf(message.author, message.member) ?? message.author.username,
      author_avatar_url: message.author.displayAvatarURL({ size: 64 }),
      author_is_bot: message.author.bot,
      content: message.content,
      embeds: message.embeds.map((embed) => embed.toJSON()) as unknown as DiscordTicketMessageInsert["embeds"],
      attachments: attachments as unknown as DiscordTicketMessageInsert["attachments"],
      created_at: message.createdAt.toISOString(),
      edited_at: message.editedAt?.toISOString() ?? null,
    });
  }

  await saveTicketTranscript(supabase, ticket.id, rows);
  return rows.length;
}
