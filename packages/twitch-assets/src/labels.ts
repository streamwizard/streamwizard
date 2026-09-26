import { TwitchApi } from "@repo/twitch-api";
import { supabase } from "@repo/supabase";
import { selectCreditsStream } from "@repo/supabase/queries/credits";
import {
  selectLabelEventRows,
  selectLabelPeriodLeaders,
  selectRecentLabelEventRows,
  selectStreamLabelsRow,
} from "@repo/supabase/queries/stream-labels";
import {
  LABEL_EVENTS_CAP,
  buildLabelHistory,
  buildSessionLabels,
  emptyPeriodLeaders,
  emptySessionLabels,
  latestLabelsFromRow,
  type LabelHelixTotals,
  type LabelSnapshot,
} from "@repo/schemas";
import { singleFlight } from "./cache";
import { liveFollowerTotal } from "./live";

/**
 * The Label widget's snapshot:
 * - `latest`: the stream_labels row the bot keeps (live or offline).
 * - `session`: the live stream's events (or the last stream's, while
 *   offline) rolled up by the same reducer overlays run on live events.
 *   Stream pick is the credits one: live first, else the latest tracked.
 * - `helix`: follower and sub totals.
 * - `history` + `period_leaders`: the newest events across all streams and
 *   the top cheerers per calendar period, for the time filter.
 *
 * Never cached, same contract as live.ts: a reload must show the true value.
 * Helix failures don't fail the snapshot; a token without
 * channel:read:subscriptions still gets every other label.
 */
export async function liveLabels(broadcasterId: string): Promise<LabelSnapshot> {
  return singleFlight(`labels:${broadcasterId}`, async () => {
    const [row, session, helix, historyRows, periodLeaders] = await Promise.all([
      selectStreamLabelsRow(supabase, broadcasterId),
      sessionLabels(broadcasterId),
      helixTotals(broadcasterId),
      // A little over the cap: gift recipients and hype train progress rows don't show.
      selectRecentLabelEventRows(supabase, broadcasterId, LABEL_EVENTS_CAP * 2),
      selectLabelPeriodLeaders(supabase, broadcasterId),
    ]);
    if (row.error) throw new Error(row.error.message);
    if (periodLeaders.error) throw new Error(periodLeaders.error.message);
    return {
      broadcaster_id: broadcasterId,
      latest: latestLabelsFromRow(row.data),
      session,
      helix,
      history: buildLabelHistory(historyRows, broadcasterId),
      period_leaders: { ...emptyPeriodLeaders(), ...periodLeaders.data },
    };
  });
}

async function sessionLabels(broadcasterId: string) {
  const pick = await selectCreditsStream(supabase, broadcasterId);
  if (!pick) return emptySessionLabels();
  const rows = await selectLabelEventRows(supabase, pick.stream_id, broadcasterId);
  return buildSessionLabels(rows, {
    stream_id: pick.stream_id,
    is_live: pick.is_live,
    started_at: pick.started_at,
    broadcaster_id: broadcasterId,
  });
}

async function helixTotals(broadcasterId: string): Promise<LabelHelixTotals> {
  const [followers, subs] = await Promise.allSettled([
    liveFollowerTotal(broadcasterId),
    singleFlight(`live:sub-totals:${broadcasterId}`, () =>
      new TwitchApi(broadcasterId).subscriptions.getSubscriberTotals(),
    ),
  ]);
  return {
    followers: followers.status === "fulfilled" ? followers.value : null,
    subscribers: subs.status === "fulfilled" ? subs.value.total : null,
    sub_points: subs.status === "fulfilled" ? subs.value.points : null,
  };
}
