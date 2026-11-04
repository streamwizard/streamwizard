import { escapeMarkdown, GuildPremiumTier } from "discord.js";
import type { AttachmentPayload, MessageCreateOptions } from "discord.js";
import { reportError } from "@repo/sentry";

// Files from a ticket form's upload fields. Discord's links to them expire, so
// the bot downloads each one and uploads it again into the ticket's first
// message. From there the live archive records it like any other attachment.
// A file that can't make it never stops the ticket from opening: it is listed
// for the opener and for staff instead.

/** A file someone attached in the ticket form, as Discord handed it over. */
export interface TicketUpload {
  /** The form field it was attached to. */
  fieldId: string;
  name: string;
  url: string;
  size: number;
  contentType: string | null;
}

export interface SkippedUpload {
  name: string;
  /** Why, in words for the opener: "that file type isn't allowed". */
  reason: string;
}

/** Discord takes 10 attachments per message. */
export const MESSAGE_FILES_MAX = 10;

const MB = 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30_000;

/** What a bot can upload in a guild: 10 MB, more with boosts. */
export function guildUploadLimit(premiumTier: GuildPremiumTier): number {
  if (premiumTier === GuildPremiumTier.Tier3) return 100 * MB;
  if (premiumTier === GuildPremiumTier.Tier2) return 50 * MB;
  return 10 * MB;
}

/** Screenshots and the files a bug report tends to need. Checked by extension, or by type for a name without one. */
const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "pdf", "txt", "log", "zip"]);
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
]);

/** Shown under an upload field that has no hint of its own. Discord allows 100 characters there. */
export const UPLOAD_TYPES_HINT = "Images (PNG, JPG, GIF, WebP), PDF, TXT, LOG or ZIP.";

export function isAllowedUpload(upload: Pick<TicketUpload, "name" | "contentType">): boolean {
  const dot = upload.name.lastIndexOf(".");
  if (dot > 0) return ALLOWED_EXTENSIONS.has(upload.name.slice(dot + 1).toLowerCase());
  return ALLOWED_TYPES.has(upload.contentType?.split(";")[0]?.trim().toLowerCase() ?? "");
}

/** "10 MB", "1.5 MB", "300 KB". */
export function formatBytes(bytes: number): string {
  if (bytes >= MB) return `${Number((bytes / MB).toFixed(1))} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const TYPE_NOT_ALLOWED = "that file type isn't allowed";
const tooBig = (limit: number) => `bigger than the ${formatBytes(limit)} this server allows`;
const DOWNLOAD_FAILED = "couldn't get it from Discord";
const UPLOAD_REFUSED = "Discord didn't take the upload";
export const NO_ATTACH_PERMISSION = "the bot isn't allowed to attach files in the ticket channel";

/** Splits the form's files into those worth downloading and those that won't fit or aren't allowed. */
export function checkUploads(
  uploads: TicketUpload[],
  limitBytes: number,
): { accepted: TicketUpload[]; skipped: SkippedUpload[] } {
  const accepted: TicketUpload[] = [];
  const skipped: SkippedUpload[] = [];
  for (const upload of uploads) {
    if (!isAllowedUpload(upload)) skipped.push({ name: upload.name, reason: TYPE_NOT_ALLOWED });
    else if (upload.size > limitBytes) skipped.push({ name: upload.name, reason: tooBig(limitBytes) });
    else accepted.push(upload);
  }
  return { accepted, skipped };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** "**a.png** (that file type isn't allowed), **b.zip** (…)". */
const listSkipped = (skipped: SkippedUpload[]) =>
  skipped.map((file) => `**${escapeMarkdown(file.name)}** (${file.reason})`).join(", ");

const files = (count: number) => (count === 1 ? "1 file" : `${count} files`);

/** For the opener, under "your ticket is open". Empty when everything made it. */
export function skippedForOpener(skipped: SkippedUpload[]): string {
  if (skipped.length === 0) return "";
  return `Couldn't attach ${files(skipped.length)}: ${listSkipped(skipped)}. Post them in the ticket if you still need them.`;
}

/** For staff, in the ticket channel. Empty when everything made it. */
export function skippedForStaff(skipped: SkippedUpload[]): string {
  if (skipped.length === 0) return "";
  return `${files(skipped.length)} from the form didn't make it: ${listSkipped(skipped)}.`;
}

/** Downloads one file from Discord's CDN. Throws when it is gone, too slow, or bigger than the guild takes. */
export async function fetchUpload(upload: TicketUpload, limitBytes: number): Promise<Buffer> {
  const response = await fetch(upload.url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Download failed with ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength > limitBytes) throw new Error("Download is bigger than the upload limit");
  return body;
}

interface PostOptions {
  limitBytes: number;
  /** Whether the bot holds Attach Files in the channel. */
  canAttach: boolean;
  fetchFile?: (upload: TicketUpload, limitBytes: number) => Promise<Buffer>;
  /** For error reports. */
  ticketId?: string;
}

/** Fetches a batch; files that can't be fetched are skipped, not fatal. */
async function download(
  batch: TicketUpload[],
  { limitBytes, fetchFile = fetchUpload, ticketId }: PostOptions,
  skipped: SkippedUpload[],
): Promise<AttachmentPayload[]> {
  const results = await Promise.all(
    batch.map(async (upload) => {
      try {
        return { attachment: await fetchFile(upload, limitBytes), name: upload.name } satisfies AttachmentPayload;
      } catch (error) {
        reportError(error, "discord-bot tickets: download form upload", { ticketId, name: upload.name });
        skipped.push({ name: upload.name, reason: DOWNLOAD_FAILED });
        return null;
      }
    }),
  );
  return results.filter((file) => file !== null);
}

/**
 * Posts the ticket's first message with the opener's files on it; files past
 * Discord's 10 per message follow in messages of their own. Returns what didn't
 * make it. Throws only when the first message can't be posted at all, with or
 * without files, so the caller can clean up the half-made ticket.
 */
export async function postWithUploads(
  channel: { send(options: MessageCreateOptions): Promise<unknown> },
  first: MessageCreateOptions,
  uploads: TicketUpload[],
  options: PostOptions,
): Promise<SkippedUpload[]> {
  const { accepted, skipped } = checkUploads(uploads, options.limitBytes);
  if (accepted.length > 0 && !options.canAttach) {
    skipped.push(...accepted.map((upload) => ({ name: upload.name, reason: NO_ATTACH_PERMISSION })));
    await channel.send(first);
    return skipped;
  }

  // A batch at a time, so no more than 10 files sit in memory at once.
  const [firstBatch = [], ...rest] = chunk(accepted, MESSAGE_FILES_MAX);
  const firstFiles = await download(firstBatch, options, skipped);
  try {
    await channel.send(firstFiles.length > 0 ? { ...first, files: firstFiles } : first);
  } catch (error) {
    if (firstFiles.length === 0) throw error;
    // The files are the likeliest reason; the ticket opens without them.
    reportError(error, "discord-bot tickets: post form uploads", {
      ticketId: options.ticketId,
      count: firstFiles.length,
    });
    skipped.push(...firstFiles.map((file) => ({ name: file.name ?? "file", reason: UPLOAD_REFUSED })));
    await channel.send(first);
  }

  for (const batch of rest) {
    const batchFiles = await download(batch, options, skipped);
    if (batchFiles.length === 0) continue;
    try {
      await channel.send({ files: batchFiles, allowedMentions: { parse: [] } });
    } catch (error) {
      reportError(error, "discord-bot tickets: post form uploads", {
        ticketId: options.ticketId,
        count: batchFiles.length,
      });
      skipped.push(...batchFiles.map((file) => ({ name: file.name ?? "file", reason: UPLOAD_REFUSED })));
    }
  }
  return skipped;
}
