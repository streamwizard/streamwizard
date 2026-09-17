import type { DiscordTicketCategory } from "@repo/supabase/queries/tickets";

export const TICKET_CATEGORY_LABELS: Record<DiscordTicketCategory, string> = {
  bug: "Bug",
  feature: "Feature request",
  support: "Support",
  other: "Other",
};

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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
