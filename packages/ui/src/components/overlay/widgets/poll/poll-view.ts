import type { PollWidgetItemConfig } from "./poll-widget-config";
import type { PollSnapshot } from "./poll-widget-state";

export interface PollChoiceView {
  id: string;
  title: string;
  votes: number;
  /** 0–1 of all votes. */
  share: number;
  /** 0–1 against the leading choice, for designs that scale to the leader. */
  relative: number;
  /** Whole percent, floored, so the choices never add up past 100. */
  percent: number;
  percentText: string;
  votesText: string;
  /** Holds the most votes (ties included); nobody leads at zero votes. */
  isLeader: boolean;
  /** Won the closed poll (ties included). */
  isWinner: boolean;
  color: string;
}

export interface PollView {
  pollId: string;
  /** "" when neither the widget nor Twitch has one: designs then show no title. */
  title: string;
  choices: PollChoiceView[];
  totalVotes: number;
  totalText: string;
  ended: boolean;
  /** Seconds left while it runs; 0 once closed. */
  secondsLeft: number;
  /** "1:05" while it runs, the result line once closed. */
  timerText: string;
  /** The leading choice (the first on a tie), or null before any votes. */
  leader: PollChoiceView | null;
  /** "Hard socks wins", "Tie" or "No votes"; "" while running. */
  resultText: string;
  /** Screen-reader summary. */
  label: string;
}

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

export function formatPollTimer(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function buildPollView(poll: PollSnapshot, cfg: PollWidgetItemConfig, now: number): PollView {
  const total = poll.choices.reduce((sum, c) => sum + c.votes, 0);
  const max = poll.choices.reduce((m, c) => Math.max(m, c.votes), 0);
  const ended = poll.endedAt !== null;

  const choices = poll.choices.map((c, i): PollChoiceView => {
    const share = total > 0 ? c.votes / total : 0;
    const isLeader = max > 0 && c.votes === max;
    const percent = Math.floor(share * 100);
    return {
      id: c.id,
      title: c.title,
      votes: c.votes,
      share,
      relative: max > 0 ? c.votes / max : 0,
      percent,
      percentText: `${percent}%`,
      votesText: plural(c.votes, "vote", "votes"),
      isLeader,
      isWinner: ended && isLeader,
      color:
        cfg.colorMode === "leader"
          ? isLeader
            ? cfg.leaderColor
            : cfg.otherColor
          : (cfg.choiceColors[i % cfg.choiceColors.length] ?? cfg.leaderColor),
    };
  });

  const leaders = choices.filter((c) => c.isLeader);
  const leader = leaders[0] ?? null;
  const secondsLeft = !ended && poll.endsAt !== null ? Math.max(0, Math.ceil((poll.endsAt - now) / 1000)) : 0;
  const resultText = !ended ? "" : leaders.length === 0 ? "No votes" : leaders.length > 1 ? "Tie" : `${leader!.title} wins`;
  const title = cfg.title.trim() || poll.title.trim();

  return {
    pollId: poll.id,
    title,
    choices,
    totalVotes: total,
    totalText: plural(total, "vote", "votes"),
    ended,
    secondsLeft,
    timerText: ended ? resultText : formatPollTimer(secondsLeft),
    leader,
    resultText,
    label: [
      title || "Poll",
      ...choices.map((c) => `${c.title}: ${c.percentText}`),
      ended ? resultText : `${formatPollTimer(secondsLeft)} left`,
    ].join(", "),
  };
}
