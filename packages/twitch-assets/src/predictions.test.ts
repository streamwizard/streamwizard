import { describe, expect, test } from "bun:test";
import type { HelixPrediction } from "@repo/twitch-api";
import { RECENT_PREDICTION_MS, toPublicPrediction } from "./predictions";

const base: HelixPrediction = {
  id: "pr1",
  broadcaster_id: "1",
  broadcaster_name: "Someone",
  broadcaster_login: "someone",
  title: "Will I beat this boss?",
  winning_outcome_id: null,
  outcomes: [
    { id: "a", title: "Yes", users: 12, channel_points: 4000, color: "BLUE" },
    { id: "b", title: "No", users: 30, channel_points: 9000, color: "PINK" },
  ],
  prediction_window: 120,
  status: "ACTIVE",
  created_at: "2026-10-08T12:00:00.000Z",
  ended_at: null,
  locked_at: null,
};

describe("toPublicPrediction", () => {
  test("an open prediction gets locks_at from its window", () => {
    const p = toPublicPrediction(base, Date.parse("2026-10-08T12:01:00Z"))!;
    expect(p.status).toBe("active");
    expect(p.locks_at).toBe("2026-10-08T12:02:00.000Z");
    expect(p.ended_at).toBeNull();
    expect(p.winning_outcome_id).toBeNull();
    expect(p.outcomes[1]).toEqual({ id: "b", title: "No", color: "pink", users: 30, channel_points: 9000 });
  });

  test("a locked prediction is kept however long it waits for its result", () => {
    const locked = { ...base, status: "LOCKED" as const, locked_at: "2026-10-08T12:02:00.000Z" };
    const hoursLater = Date.parse("2026-10-08T15:00:00Z");
    expect(toPublicPrediction(locked, hoursLater)?.status).toBe("locked");
  });

  test("a prediction that just resolved is kept with its winner, an old one is dropped", () => {
    const resolved = {
      ...base,
      status: "RESOLVED" as const,
      winning_outcome_id: "a",
      ended_at: "2026-10-08T12:30:00.000Z",
    };
    const endedAt = Date.parse(resolved.ended_at);
    const fresh = toPublicPrediction(resolved, endedAt + 5_000)!;
    expect(fresh.status).toBe("resolved");
    expect(fresh.winning_outcome_id).toBe("a");
    expect(toPublicPrediction(resolved, endedAt + RECENT_PREDICTION_MS + 1)).toBeNull();
  });

  test("a canceled prediction has no winner", () => {
    const canceled = { ...base, status: "CANCELED" as const, ended_at: "2026-10-08T12:30:00.000Z" };
    const p = toPublicPrediction(canceled, Date.parse(canceled.ended_at) + 1000)!;
    expect(p.status).toBe("canceled");
    expect(p.winning_outcome_id).toBeNull();
  });

  test("no prediction is nothing to show", () => {
    expect(toPublicPrediction(null)).toBeNull();
  });
});
