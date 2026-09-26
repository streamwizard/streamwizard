import { describe, expect, test } from "bun:test";
import type { HelixPoll } from "@repo/twitch-api";
import { RECENT_POLL_MS, toPublicPoll } from "./polls";

const base: HelixPoll = {
  id: "p1",
  broadcaster_id: "1",
  broadcaster_name: "Someone",
  broadcaster_login: "someone",
  title: "Next game?",
  choices: [
    { id: "a", title: "Elden Ring", votes: 12, channel_points_votes: 4, bits_votes: 0 },
    { id: "b", title: "Hades", votes: 8, channel_points_votes: 0, bits_votes: 0 },
  ],
  bits_voting_enabled: false,
  bits_per_vote: 0,
  channel_points_voting_enabled: true,
  channel_points_per_vote: 100,
  status: "ACTIVE",
  duration: 120,
  started_at: "2026-09-24T12:00:00.000Z",
  ended_at: null,
};

describe("toPublicPoll", () => {
  test("a running poll gets ends_at from its duration", () => {
    const poll = toPublicPoll(base, Date.parse("2026-09-24T12:01:00Z"))!;
    expect(poll.status).toBe("active");
    expect(poll.ends_at).toBe("2026-09-24T12:02:00.000Z");
    expect(poll.ended_at).toBeNull();
    expect(poll.channel_points_voting).toEqual({ is_enabled: true, amount_per_vote: 100 });
    expect(poll.choices[0]!.votes).toBe(12);
  });

  test("a poll that just ended is kept, an old one is dropped", () => {
    const ended = { ...base, status: "COMPLETED" as const, ended_at: "2026-09-24T12:02:00.000Z" };
    const endedAt = Date.parse(ended.ended_at);
    expect(toPublicPoll(ended, endedAt + 5_000)?.status).toBe("completed");
    expect(toPublicPoll(ended, endedAt + RECENT_POLL_MS + 1)).toBeNull();
  });

  test("archived, moderated and missing polls show nothing", () => {
    expect(toPublicPoll(null)).toBeNull();
    expect(toPublicPoll({ ...base, status: "ARCHIVED", ended_at: base.started_at })).toBeNull();
    expect(toPublicPoll({ ...base, status: "MODERATED" })).toBeNull();
  });
});
