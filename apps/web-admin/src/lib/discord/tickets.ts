import type { DiscordTicket } from "@repo/supabase/queries/tickets";

// Why a ticket ended, for closes no person clicked for. "manual" has a closer
// to show instead, so it has no label here.
export const TICKET_CLOSE_CAUSES: Record<string, string> = {
  channel_deleted: "Channel was deleted",
  member_left: "Opener left the server",
  inactivity: "Went quiet",
  force: "Force closed",
};

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

/** "18 Sept, 03:33": for dense lists where the year is noise. */
export function formatDateTimeShort(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** "03:33": for messages under a day divider. */
export function formatTimeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** "18 September 2026": a day divider. */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5m ago", "3h ago", "2d ago", then the date. Pair with a `title` holding the full timestamp. */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const elapsed = Math.max(0, now - new Date(iso).getTime());
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.round(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.round(elapsed / HOUR)}h ago`;
  if (elapsed < 14 * DAY) return `${Math.round(elapsed / DAY)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export type TicketTone = "open" | "attention" | "quiet" | "closed";

/** The status dot for each tone, shared by the list and the ticket page. */
export const TICKET_TONE_DOT: Record<TicketTone, string> = {
  open: "bg-emerald-500",
  attention: "bg-amber-500",
  quiet: "border border-muted-foreground/60",
  closed: "border border-muted-foreground/40",
};

export interface TicketState {
  label: string;
  tone: TicketTone;
  hint?: string;
}

/** One word for where a ticket stands, in the order staff care: who's waiting on them first. */
export function ticketState(
  ticket: Pick<DiscordTicket, "status" | "close_requested_at" | "last_message_by_staff" | "stale_warned_at">,
): TicketState {
  if (ticket.status !== "open") return { label: "Closed", tone: "closed" };
  if (ticket.close_requested_at) {
    return { label: "Close requested", tone: "attention", hint: "The opener asked to close it. Accept or reject on the ticket." };
  }
  if (ticket.last_message_by_staff !== true) return { label: "Needs reply", tone: "attention", hint: "The opener wrote last." };
  if (ticket.stale_warned_at) return { label: "Quiet", tone: "quiet", hint: `Reminded ${formatDateTime(ticket.stale_warned_at)}` };
  return { label: "Open", tone: "open" };
}

export const PRIORITY_LABELS: Record<string, string> = { low: "Low", medium: "Medium", high: "High" };

/** Text color for a priority: only High shouts. */
export function priorityClass(priority: string | null): string | undefined {
  if (priority === "high") return "font-medium text-red-600 dark:text-red-400";
  if (priority === "low") return "text-muted-foreground";
  return undefined;
}
