import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

// The aggregate reads behind the stats page and the [stats.*] placeholders.
// All three are SQL functions (ticket_stats_*), so the numbers are computed
// where the rows are. Ranges are half-open: from inclusive, to exclusive.

export interface TicketStatsRange {
  from: Date;
  to: Date;
}

export interface TicketStatsSummary {
  opened: number;
  closed: number;
  /** Seconds from opening to the first staff message. Null with no data. */
  avgFirstResponseSeconds: number | null;
  /** Seconds from opening to close. Null with no data. */
  avgResolutionSeconds: number | null;
  avgRating: number | null;
  ratingCount: number;
}

const args = (guildId: string, range: TicketStatsRange) => ({
  p_guild_id: guildId,
  p_from: range.from.toISOString(),
  p_to: range.to.toISOString(),
});

export async function getTicketStatsSummary(client: DBClient, guildId: string, range: TicketStatsRange): Promise<TicketStatsSummary> {
  const { data, error } = await client.rpc("ticket_stats_summary", args(guildId, range));
  if (error) throw error;
  const row = data[0];
  return {
    opened: Number(row?.opened ?? 0),
    closed: Number(row?.closed ?? 0),
    avgFirstResponseSeconds: row?.avg_first_response_seconds ?? null,
    avgResolutionSeconds: row?.avg_resolution_seconds ?? null,
    avgRating: row?.avg_rating ?? null,
    ratingCount: Number(row?.rating_count ?? 0),
  };
}

export interface TicketStatsDay {
  /** YYYY-MM-DD */
  day: string;
  opened: number;
  closed: number;
}

export async function getTicketStatsByDay(client: DBClient, guildId: string, range: TicketStatsRange): Promise<TicketStatsDay[]> {
  const { data, error } = await client.rpc("ticket_stats_by_day", args(guildId, range));
  if (error) throw error;
  return data.map((row) => ({ day: row.day, opened: Number(row.opened), closed: Number(row.closed) }));
}

export interface TicketStatsCategory {
  category: string;
  opened: number;
  closed: number;
  avgRating: number | null;
  ratingCount: number;
}

export async function getTicketStatsByCategory(
  client: DBClient,
  guildId: string,
  range: TicketStatsRange,
): Promise<TicketStatsCategory[]> {
  const { data, error } = await client.rpc("ticket_stats_by_category", args(guildId, range));
  if (error) throw error;
  return data.map((row) => ({
    category: row.category,
    opened: Number(row.opened),
    closed: Number(row.closed),
    avgRating: row.avg_rating ?? null,
    ratingCount: Number(row.rating_count),
  }));
}

/** "2h 10m", "35m", "3d 4h": a duration for a stat card or a placeholder. Null when unknown. */
export function formatDurationShort(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
  const days = Math.floor(hours / 24);
  return `${days}d${hours % 24 ? ` ${hours % 24}h` : ""}`;
}
