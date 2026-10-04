import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getAlertStates } from "@repo/supabase/queries/alerts";
import { getOpenTicketCounts } from "@repo/supabase/queries/tickets";
import { getDiscordContext } from "@/lib/discord/api";
import { homeEnv } from "@/lib/home-env";
import type { NavCounts } from "@/lib/nav-counts-shared";

async function countFiringAlerts(): Promise<number> {
  const states = await getAlertStates(supabaseAdmin, homeEnv());
  const now = Date.now();
  return states.filter(
    (state) => state.status === "firing" && !(state.silenced_until && new Date(state.silenced_until).getTime() > now),
  ).length;
}

export async function countTicketsAwaitingStaff(): Promise<number> {
  const ctx = getDiscordContext();
  if (!ctx) return 0;
  return (await getOpenTicketCounts(supabaseAdmin, ctx.guildId)).awaitingStaff;
}

export async function countPendingWidgets(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("overlay_widget_library_entries")
    .select("id", { count: "exact", head: true })
    .eq("is_approved", false);
  if (error) throw error;
  return count ?? 0;
}

/** Each counter fails on its own: a broken query shows 0, never takes the nav down. */
export async function getNavCounts(): Promise<NavCounts> {
  const [alerts, tickets, widgets] = await Promise.allSettled([
    countFiringAlerts(),
    countTicketsAwaitingStaff(),
    countPendingWidgets(),
  ]);
  const value = (result: PromiseSettledResult<number>, name: string) => {
    if (result.status === "fulfilled") return result.value;
    console.warn(`[web-admin] nav count "${name}" failed:`, result.reason instanceof Error ? result.reason.message : result.reason);
    return 0;
  };
  return { alerts: value(alerts, "alerts"), tickets: value(tickets, "tickets"), widgets: value(widgets, "widgets") };
}
