import { formatTicketNumber } from "@repo/supabase/queries/tickets";

// The plain-text transcript that goes to the opener when a ticket closes and
// to staff on /ticket transcript. Pure: rows in, one string out.

export interface TranscriptTicket {
  ticket_number: number;
  subject: string;
  opener_name: string | null;
  created_at: string;
  closed_at: string | null;
  closed_by_name: string | null;
  close_reason: string | null;
}

export interface TranscriptRow {
  author_name: string;
  author_is_bot: boolean;
  content: string;
  embeds: unknown;
  attachments: unknown;
  created_at: string;
  edited_at: string | null;
  deleted_at?: string | null;
  pinned?: boolean;
}

interface EmbedLike {
  title?: string;
  description?: string;
  author?: { name?: string };
  fields?: { name: string; value: string }[];
  url?: string;
}

interface AttachmentLike {
  name: string;
  size: number;
  url: string | null;
}

/** 2026-09-18 10:04 UTC, always UTC so a file reads the same wherever it is opened. */
export function stamp(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

function embedLines(embed: EmbedLike): string[] {
  const lines: string[] = [];
  const head = [embed.author?.name, embed.title].filter(Boolean).join(" · ");
  if (head) lines.push(head);
  if (embed.description) lines.push(embed.description);
  for (const field of embed.fields ?? []) lines.push(`${field.name}: ${field.value}`);
  if (lines.length === 0 && embed.url) lines.push(embed.url);
  return lines;
}

export interface TranscriptContext {
  serverName: string;
  categoryName: string;
}

export function renderTranscriptText(ticket: TranscriptTicket, rows: TranscriptRow[], context: TranscriptContext): string {
  const out: string[] = [];
  out.push(`Ticket ${formatTicketNumber(ticket.ticket_number)} · ${context.categoryName} · ${context.serverName}`);
  out.push(`Subject: ${ticket.subject}`);
  out.push(`Opened by ${ticket.opener_name ?? "unknown"} on ${stamp(ticket.created_at)}`);
  if (ticket.closed_at) {
    const by = ticket.closed_by_name ? `by ${ticket.closed_by_name} ` : "";
    out.push(`Closed ${by}on ${stamp(ticket.closed_at)}${ticket.close_reason ? `: ${ticket.close_reason}` : ""}`);
  }
  out.push(`Messages: ${rows.length}`);
  out.push("");

  for (const row of rows) {
    const marks = [
      row.author_is_bot ? "bot" : null,
      row.pinned ? "pinned" : null,
      row.edited_at ? "edited" : null,
      row.deleted_at ? "deleted" : null,
    ].filter(Boolean);
    const suffix = marks.length ? ` (${marks.join(", ")})` : "";
    out.push(`[${stamp(row.created_at)}] ${row.author_name}${suffix}:`);
    if (row.content) for (const line of row.content.split("\n")) out.push(`    ${line}`);
    for (const embed of (Array.isArray(row.embeds) ? row.embeds : []) as EmbedLike[]) {
      for (const line of embedLines(embed)) out.push(`    | ${line}`);
    }
    for (const attachment of (Array.isArray(row.attachments) ? row.attachments : []) as AttachmentLike[]) {
      out.push(`    attachment: ${attachment.name} (${kb(attachment.size)})${attachment.url ? ` ${attachment.url}` : ""}`);
    }
    out.push("");
  }
  return out.join("\n").trimEnd() + "\n";
}

export const transcriptFileName = (ticketNumber: number) => `ticket-${formatTicketNumber(ticketNumber).replace("#", "")}.txt`;
