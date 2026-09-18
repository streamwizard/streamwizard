import { randomUUID } from "node:crypto";
import type { Attachment, Collection, Message, TextChannel } from "discord.js";
import { R2Storage } from "@repo/storage";
import { supabase } from "@repo/supabase";
import {
  countCopiedImages,
  insertMissingTicketMessages,
  listArchivedMessageIds,
  stampTicketTranscript,
  type ArchivedMessage,
} from "@repo/supabase/queries/ticket-archive";
import { reportError } from "@repo/sentry";
import { env } from "./env";
import { displayNameOf } from "./server-log/refs";

// Turns a Discord message into an archive row. Small images are copied to R2
// so screenshots survive Discord's expiring CDN links; anything bigger, and
// every non-image file, keeps metadata only to keep storage cheap. The live
// archive (lib/tickets/archive.ts) does this per message as it arrives; the
// reconcile below walks the channel once, at close and at startup, and only
// inserts what the archive missed.

export const MAX_IMAGE_BYTES = 500 * 1024;
export const MAX_IMAGES_PER_TICKET = 20;
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

interface TicketRef {
  id: string;
  guild_id: string;
}

/** Mutable: how many images of this ticket have an R2 copy so far. */
export interface ImageBudget {
  imagesCopied: number;
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

async function copyImage(ticket: TicketRef, attachment: Attachment) {
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

export const isSmallImage = (attachment: Pick<Attachment, "contentType" | "size">): boolean =>
  IMAGE_TYPES.has(attachment.contentType?.split(";")[0] ?? "") && attachment.size <= MAX_IMAGE_BYTES;

/** The archive row for one message. Copies its small images to R2 while the ticket's budget lasts. */
export async function toArchivedMessage(ticket: TicketRef, message: Message, budget: ImageBudget): Promise<ArchivedMessage> {
  const attachments: StoredAttachment[] = [];
  for (const attachment of message.attachments.values()) {
    let copied: { key: string; url: string } | null = null;
    if (isSmallImage(attachment) && budget.imagesCopied < MAX_IMAGES_PER_TICKET) {
      // A failed copy only loses the preview, never the message.
      copied = await copyImage(ticket, attachment).catch((error) => {
        reportError(error, "discord-bot tickets: copy image", { ticketId: ticket.id, attachmentId: attachment.id });
        return null;
      });
      if (copied) budget.imagesCopied++;
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

  return {
    message_id: message.id,
    author_discord_id: message.author.id,
    author_name: displayNameOf(message.author, message.member) ?? message.author.username,
    author_avatar_url: message.author.displayAvatarURL({ size: 64 }),
    author_is_bot: message.author.bot,
    content: message.content,
    embeds: message.embeds.map((embed) => embed.toJSON()) as unknown as ArchivedMessage["embeds"],
    attachments: attachments as unknown as ArchivedMessage["attachments"],
    created_at: message.createdAt.toISOString(),
    edited_at: message.editedAt?.toISOString() ?? null,
  };
}

/**
 * Walks the channel and archives every message the live archive missed, then
 * stamps the transcript as saved. Returns the transcript's size. Throws if the
 * channel can't be read or the rows can't be written, so a close can refuse to
 * delete the channel.
 */
export async function reconcileTicketTranscript(channel: TextChannel, ticket: TicketRef): Promise<number> {
  const [messages, archived] = await Promise.all([fetchAllMessages(channel), listArchivedMessageIds(supabase, ticket.id)]);
  const missing = messages.filter((message) => !archived.has(message.id));

  if (missing.length > 0) {
    // Images already copied count against the cap; the rest of the budget goes to the gap.
    const budget: ImageBudget = { imagesCopied: await countCopiedImages(supabase, ticket.id) };
    const rows: ArchivedMessage[] = [];
    for (const message of missing) rows.push(await toArchivedMessage(ticket, message, budget));
    await insertMissingTicketMessages(supabase, ticket.id, rows);
  }
  return stampTicketTranscript(supabase, ticket.id);
}

