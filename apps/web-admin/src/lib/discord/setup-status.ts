import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getGuildSettings } from "@repo/supabase/queries/discord";
import { getLogRouting } from "@repo/supabase/queries/platform-events";
import { getTicketSettings } from "@repo/supabase/queries/tickets";
import { getDiscordContext } from "./api";

// Server-only: feeds the sidebar "Not set up" badges. Runs on every dashboard
// page, so it stays cheap: three settings rows, no Discord API calls.

/** Sidebar hrefs of Discord features that can't work until a channel is picked. */
export type DiscordSetupGaps = Set<string>;

const NONE: DiscordSetupGaps = new Set();

export async function getDiscordSetupGaps(): Promise<DiscordSetupGaps> {
  const ctx = getDiscordContext();
  if (!ctx) return NONE;

  try {
    const [welcome, tickets, logRouting] = await Promise.all([
      getGuildSettings(supabaseAdmin, ctx.guildId),
      getTicketSettings(supabaseAdmin, ctx.guildId),
      getLogRouting(supabaseAdmin, ctx.guildId),
    ]);

    const gaps: DiscordSetupGaps = new Set();

    // The bot falls back to the server's system channel, but "set up" means
    // someone picked a welcome channel here. Off on purpose is fine.
    if (welcome?.welcome_enabled !== false && !welcome?.welcome_channel_id) gaps.add("/discord/welcome");

    // Tickets need a panel channel and a category before the panel can go up.
    if (!tickets?.panel_channel_id || !tickets.category_id) gaps.add("/discord/tickets");

    // Every log event falls back to the default channel.
    if (!logRouting.defaultChannelId) gaps.add("/discord/logs");

    // Go-live posts have nowhere to go without a channel. Off on purpose is fine.
    if (welcome?.live_enabled && !welcome.live_channel_id) gaps.add("/discord/live");

    return gaps;
  } catch (error) {
    // The sidebar must never take the dashboard down with it.
    console.warn("[web-admin] Discord setup check failed:", error instanceof Error ? error.message : error);
    return NONE;
  }
}
