import type { VariableValues } from "@repo/discord-message";
import { supabase } from "@repo/supabase";
import { formatDurationShort, getTicketStatsSummary } from "@repo/supabase/queries/ticket-stats";
import { TtlCache } from "@repo/ttl-cache";

// The [stats.*] placeholders: rolling 30-day numbers a server can quote in
// its opening message or closing DM. Cached per guild for five minutes; a
// ticket open never waits on an aggregate more than once in that window.

const STATS_TTL_MS = 5 * 60 * 1000;
const WINDOW_DAYS = 30;

const cache = new TtlCache<VariableValues>({ ttlMs: STATS_TTL_MS });

export async function ticketStatsValues(guildId: string, now = new Date()): Promise<VariableValues> {
  const values = await cache.fetch(guildId, async () => {
    const summary = await getTicketStatsSummary(supabase, guildId, {
      from: new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000),
      to: now,
    });
    return {
      "stats.avg_response": formatDurationShort(summary.avgFirstResponseSeconds) ?? "a little while",
      "stats.avg_rating": summary.avgRating === null ? "no ratings yet" : `${summary.avgRating.toFixed(1)}/5`,
    };
  });
  // The aggregate failing must never block a ticket: placeholders then stay as typed.
  return values ?? {};
}
