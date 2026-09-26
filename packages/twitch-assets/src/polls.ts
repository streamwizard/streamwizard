import type { HelixPoll } from "@repo/twitch-api";
import type { PublicPoll, PublicPollStatus } from "./types";

/**
 * How long after it ends a poll still counts as "live": a refresh during the
 * winner reveal brings it back instead of showing nothing.
 */
export const RECENT_POLL_MS = 60_000;

const STATUS: Partial<Record<HelixPoll["status"], PublicPollStatus>> = {
  ACTIVE: "active",
  COMPLETED: "completed",
  TERMINATED: "terminated",
  ARCHIVED: "archived",
};

/**
 * Get Polls into the channel.poll.* shape, or null when there is nothing to
 * show: an archived, moderated or invalid poll, or one that ended over a
 * minute ago.
 */
export function toPublicPoll(poll: HelixPoll | null, now: number = Date.now()): PublicPoll | null {
  if (!poll) return null;
  const status = STATUS[poll.status];
  if (!status || status === "archived") return null;
  if (status !== "active") {
    const ended = poll.ended_at ? Date.parse(poll.ended_at) : NaN;
    if (!Number.isFinite(ended) || now - ended > RECENT_POLL_MS) return null;
  }
  const endsAt = new Date(Date.parse(poll.started_at) + poll.duration * 1000).toISOString();
  return {
    id: poll.id,
    title: poll.title,
    choices: poll.choices.map((c) => ({
      id: c.id,
      title: c.title,
      votes: c.votes,
      channel_points_votes: c.channel_points_votes,
      bits_votes: c.bits_votes,
    })),
    status,
    started_at: poll.started_at,
    ends_at: endsAt,
    ended_at: status === "active" ? null : poll.ended_at,
    bits_voting: { is_enabled: poll.bits_voting_enabled, amount_per_vote: poll.bits_per_vote },
    channel_points_voting: { is_enabled: poll.channel_points_voting_enabled, amount_per_vote: poll.channel_points_per_vote },
  };
}
