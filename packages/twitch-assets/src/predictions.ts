import type { HelixPrediction } from "@repo/twitch-api";
import type { PublicPrediction, PublicPredictionStatus } from "./types";

/**
 * How long after it ends a prediction still counts as "live": a refresh
 * during the result brings it back instead of showing nothing.
 */
export const RECENT_PREDICTION_MS = 60_000;

const STATUS: Record<HelixPrediction["status"], PublicPredictionStatus> = {
  ACTIVE: "active",
  LOCKED: "locked",
  RESOLVED: "resolved",
  CANCELED: "canceled",
};

/**
 * Get Predictions into the channel.prediction.* shape, or null when there is
 * nothing to show: no prediction, or one that ended over a minute ago. A
 * locked prediction has no such limit; it is still waiting for its result.
 */
export function toPublicPrediction(prediction: HelixPrediction | null, now: number = Date.now()): PublicPrediction | null {
  if (!prediction) return null;
  const status = STATUS[prediction.status];
  if (!status) return null;
  const ended = status === "resolved" || status === "canceled";
  if (ended) {
    const endedAt = prediction.ended_at ? Date.parse(prediction.ended_at) : NaN;
    if (!Number.isFinite(endedAt) || now - endedAt > RECENT_PREDICTION_MS) return null;
  }
  return {
    id: prediction.id,
    title: prediction.title,
    outcomes: prediction.outcomes.map((o) => ({
      id: o.id,
      title: o.title,
      color: o.color === "PINK" ? "pink" : "blue",
      users: o.users,
      channel_points: o.channel_points,
    })),
    status,
    started_at: prediction.created_at,
    locks_at: new Date(Date.parse(prediction.created_at) + prediction.prediction_window * 1000).toISOString(),
    locked_at: prediction.locked_at,
    ended_at: ended ? prediction.ended_at : null,
    winning_outcome_id: status === "resolved" ? prediction.winning_outcome_id : null,
  };
}
