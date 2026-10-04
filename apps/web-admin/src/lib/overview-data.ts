import { getRuleCatalog } from "@repo/alerting/rules";
import { queryObsNodeSnapshot } from "@repo/metrics";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getAlertRuleConfigs } from "@repo/supabase/queries/alert-rule-config";
import { getAlertStates } from "@repo/supabase/queries/alerts";
import { getOverviewStats } from "@repo/supabase/queries/platform-stats";
import { getDiscordSetupGaps } from "@/lib/discord/setup-status";
import { homeEnv } from "@/lib/home-env";
import { countPendingWidgets, countTicketsAwaitingStaff } from "@/lib/nav-counts";
import { activeAlerts, buildAttentionList, buildSubsystemStatus, formatLiveFor, type AttentionItem, type SubsystemStatus } from "@/lib/overview";
import { filterToRegistered, getRegisteredNodeIds } from "@/lib/registry-nodes";

// Server-only: everything the dashboard shows, loaded in one fan-out. Each
// source fails on its own, so a broken Influx or Discord hides one section and
// the page says which, instead of the whole dashboard going down.

export interface LiveRow {
  broadcasterId: string;
  name: string;
  title: string | null;
  category: string | null;
  liveFor: string;
  viewers: number | null;
  /** StreamWizard user behind the channel, when the Twitch account is linked to one. */
  userId: string | null;
}

export interface ObsLoad {
  nodes: number;
  running: number;
  capacity: number;
  /** Mean GPU utilisation across reporting nodes, null with no nodes. */
  gpuPct: number | null;
  vramUsedMb: number;
  vramTotalMb: number;
}

export interface OverviewData {
  env: string;
  attention: AttentionItem[];
  /** Null when the alert engine's state couldn't be read. */
  subsystems: SubsystemStatus[] | null;
  live: { rows: LiveRow[]; viewers: number } | null;
  obs: ObsLoad | null;
  /** Names of the sources that failed, for the "couldn't load" note. */
  failed: string[];
}

async function loadObsLoad(): Promise<ObsLoad> {
  const [snapshot, registeredIds] = await Promise.all([queryObsNodeSnapshot(), getRegisteredNodeIds("obs_nodes")]);
  // Influx keeps points of deleted nodes for a while; only count nodes that still exist.
  const nodes = filterToRegistered(snapshot, registeredIds, (node) => node.nodeId);
  return {
    nodes: nodes.length,
    running: nodes.reduce((sum, node) => sum + node.runningInstanceCount, 0),
    capacity: nodes.reduce((sum, node) => sum + node.maxInstances, 0),
    gpuPct: nodes.length > 0 ? nodes.reduce((sum, node) => sum + node.gpuUtilPct, 0) / nodes.length : null,
    vramUsedMb: nodes.reduce((sum, node) => sum + node.vramUsedMb, 0),
    vramTotalMb: nodes.reduce((sum, node) => sum + node.vramTotalMb, 0),
  };
}

/** Twitch channel id → StreamWizard user id, so a live row can link to the user page. */
async function loadUserIds(twitchUserIds: string[]): Promise<Map<string, string>> {
  if (twitchUserIds.length === 0) return new Map();
  const { data, error } = await supabaseAdmin
    .from("integrations_twitch")
    .select("user_id, twitch_user_id")
    .in("twitch_user_id", twitchUserIds);
  if (error) throw error;
  return new Map(data.map((row) => [row.twitch_user_id, row.user_id]));
}

export async function loadOverview(): Promise<OverviewData> {
  const env = homeEnv();
  const now = Date.now();
  const failed: string[] = [];

  const [statesRes, overridesRes, ticketsRes, widgetsRes, statsRes, obsRes, gapsRes] = await Promise.allSettled([
    getAlertStates(supabaseAdmin, env),
    getAlertRuleConfigs(supabaseAdmin),
    countTicketsAwaitingStaff(),
    countPendingWidgets(),
    getOverviewStats(supabaseAdmin),
    loadObsLoad(),
    getDiscordSetupGaps(),
  ]);

  const value = <T,>(result: PromiseSettledResult<T>, fallback: T, name: string): T => {
    if (result.status === "fulfilled") return result.value;
    console.error(`[overview] ${name}`, result.reason);
    failed.push(name);
    return fallback;
  };

  const states = value(statesRes, null, "alerts");
  // Without the overrides the code defaults still give a truthful enough answer.
  const overrides = overridesRes.status === "fulfilled" ? overridesRes.value : [];
  const tickets = value(ticketsRes, 0, "tickets");
  const widgets = value(widgetsRes, 0, "widget review");
  const stats = value(statsRes, null, "live streams");
  const obs = value(obsRes, null, "OBS nodes");
  const gaps = gapsRes.status === "fulfilled" ? [...gapsRes.value] : [];

  const catalog = getRuleCatalog();

  let live: OverviewData["live"] = null;
  if (stats) {
    let userIds = new Map<string, string>();
    try {
      userIds = await loadUserIds(stats.liveStreamers.map((streamer) => streamer.broadcaster_id));
    } catch (error) {
      // The list still works without links.
      console.warn("[overview] user lookup failed:", error instanceof Error ? error.message : error);
    }
    const rows = stats.liveStreamers
      .map((streamer) => ({
        broadcasterId: streamer.broadcaster_id,
        name: streamer.broadcaster_name ?? "Unknown channel",
        title: streamer.title,
        category: streamer.category_name,
        liveFor: formatLiveFor(streamer.stream_started_at, now),
        viewers: stats.viewerCounts.get(streamer.broadcaster_id) ?? null,
        userId: userIds.get(streamer.broadcaster_id) ?? null,
      }))
      .sort((a, b) => (b.viewers ?? -1) - (a.viewers ?? -1));
    live = { rows, viewers: rows.reduce((sum, row) => sum + (row.viewers ?? 0), 0) };
  }

  return {
    env,
    attention: buildAttentionList({
      alerts: states ? activeAlerts(states, now) : [],
      ruleTitles: new Map(catalog.map((rule) => [rule.id, rule.title])),
      ticketsAwaitingStaff: tickets,
      pendingWidgets: widgets,
      failedClipSyncs: stats?.failedClipSyncs ?? 0,
      setupGaps: gaps,
    }),
    subsystems: states ? buildSubsystemStatus(states, catalog, overrides, env, now) : null,
    live,
    obs,
    failed,
  };
}
