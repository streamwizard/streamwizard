import type { DiscordTicketCategory } from "@repo/supabase/queries/tickets";

export const TICKET_CATEGORY_LABELS: Record<DiscordTicketCategory, string> = {
  bug: "Bug",
  feature: "Feature request",
  support: "Support",
  other: "Other",
};

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
