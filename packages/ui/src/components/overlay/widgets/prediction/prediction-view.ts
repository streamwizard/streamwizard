import { formatPollTimer, type PollChoiceView, type PollView } from "../poll/poll-view";
import type { PredictionWidgetItemConfig } from "./prediction-widget-config";
import type { PredictionSnapshot } from "./prediction-widget-state";

/** What the designs show in place of the countdown once the prediction locks. */
export const PREDICTION_LOCKED_TEXT = "Locked";
/** What a canceled prediction shows as its result: everyone got their points back. */
export const PREDICTION_CANCELED_TEXT = "Refunded";

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/**
 * A prediction as the poll designs draw it. Each outcome is a "choice" whose
 * votes are its channel points, so shares, bars and the leader all work as
 * they do for a poll. Two things differ, and both are settled here:
 *
 * - the winner is the outcome the streamer picked, not the one with the most
 *   points. Once resolved it is also the leader, so the designs crown it and
 *   dim the rest;
 * - between closing and the result there is a locked stretch, shown as
 *   "Locked" where the countdown was.
 */
export function buildPredictionView(prediction: PredictionSnapshot, cfg: PredictionWidgetItemConfig, now: number): PollView {
  const total = prediction.outcomes.reduce((sum, o) => sum + o.points, 0);
  const max = prediction.outcomes.reduce((m, o) => Math.max(m, o.points), 0);
  const ended = prediction.endedAt !== null;
  const winnerId = prediction.status === "resolved" ? prediction.winningOutcomeId : null;

  const choices = prediction.outcomes.map((o, i): PollChoiceView => {
    const share = total > 0 ? o.points / total : 0;
    const isWinner = winnerId !== null && o.id === winnerId;
    // After the result the outcome to highlight is the winner, whatever the points said.
    const isLeader = winnerId !== null ? isWinner : max > 0 && o.points === max;
    const percent = Math.floor(share * 100);
    return {
      id: o.id,
      title: o.title,
      votes: o.points,
      share,
      relative: max > 0 ? o.points / max : 0,
      percent,
      percentText: `${percent}%`,
      votesText: plural(o.points, "point", "points"),
      isLeader,
      isWinner,
      color:
        cfg.colorMode === "leader"
          ? isLeader
            ? cfg.leaderColor
            : cfg.otherColor
          : (cfg.choiceColors[i % cfg.choiceColors.length] ?? cfg.leaderColor),
    };
  });

  const leader = choices.find((c) => c.isLeader) ?? null;
  const winner = choices.find((c) => c.isWinner) ?? null;
  const open = prediction.status === "active";
  const secondsLeft = open && prediction.locksAt !== null ? Math.max(0, Math.ceil((prediction.locksAt - now) / 1000)) : 0;
  const resultText = !ended ? "" : winner ? `${winner.title} wins` : PREDICTION_CANCELED_TEXT;
  const statusText = ended ? resultText : open ? formatPollTimer(secondsLeft) : PREDICTION_LOCKED_TEXT;
  const title = cfg.title.trim() || prediction.title.trim();

  return {
    pollId: prediction.id,
    title,
    choices,
    totalVotes: total,
    totalText: plural(total, "point", "points"),
    ended,
    secondsLeft,
    timerText: statusText,
    leader,
    resultText,
    emptyText: ended ? "No points" : "No points yet",
    label: [
      title || "Prediction",
      ...choices.map((c) => `${c.title}: ${c.percentText}`),
      ended ? resultText : open ? `${formatPollTimer(secondsLeft)} left` : PREDICTION_LOCKED_TEXT,
    ].join(", "),
  };
}
