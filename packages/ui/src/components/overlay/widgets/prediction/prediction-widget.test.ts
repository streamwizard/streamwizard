import { describe, expect, test } from "bun:test";
import { predictionWidgetItemConfigSchema } from "../../../../overlay-schemas";
import { buildPredictionView } from "./prediction-view";
import {
  PREDICTION_DEFAULT_OUTCOME_COLORS,
  createDefaultPredictionWidgetConfig,
  normalizePredictionWidgetConfig,
} from "./prediction-widget-config";
import {
  applyPredictionFrame,
  isDemoPredictionFrame,
  seedPrediction,
  type PredictionSnapshot,
} from "./prediction-widget-state";

const T = Date.parse("2026-10-08T12:00:00Z");
const outcomes = (a: number, b: number) => [
  { id: "1", title: "Easy clap", color: "blue", users: 4, channel_points: a, top_predictors: [] },
  { id: "2", title: "Not a chance", color: "pink", users: 9, channel_points: b, top_predictors: [] },
];
const frame = (type: string, payload: Record<string, unknown>) => ({
  type,
  payload: { id: "pr1", title: "First try?", ...payload },
});
const locksAt = new Date(T + 60_000).toISOString();

describe("applyPredictionFrame", () => {
  test("begin, progress, lock and end walk one prediction through", () => {
    let s = applyPredictionFrame(
      null,
      frame("channel.prediction.begin", {
        outcomes: [
          { id: "1", title: "Easy clap", color: "blue" },
          { id: "2", title: "Not a chance", color: "pink" },
        ],
        locks_at: locksAt,
      }),
      T
    );
    expect(s?.status).toBe("active");
    expect(s?.outcomes.map((o) => o.points)).toEqual([0, 0]);
    expect(s?.locksAt).toBe(T + 60_000);

    s = applyPredictionFrame(s, frame("channel.prediction.progress", { outcomes: outcomes(500, 1500), locks_at: locksAt }), T + 1000);
    expect(s?.outcomes.map((o) => o.points)).toEqual([500, 1500]);
    expect(s?.outcomes[1]!.users).toBe(9);

    s = applyPredictionFrame(s, frame("channel.prediction.lock", { outcomes: outcomes(700, 1500) }), T + 60_000);
    expect(s?.status).toBe("locked");
    expect(s?.locksAt).toBeNull();
    expect(s?.endedAt).toBeNull();

    s = applyPredictionFrame(
      s,
      frame("channel.prediction.end", { outcomes: outcomes(700, 1500), status: "resolved", winning_outcome_id: "1" }),
      T + 90_000
    );
    expect(s?.status).toBe("resolved");
    expect(s?.winningOutcomeId).toBe("1");
    expect(s?.endedAt).toBe(T + 90_000);
  });

  test("points that land after the lock count, but do not reopen it", () => {
    const locked = applyPredictionFrame(null, frame("channel.prediction.lock", { outcomes: outcomes(700, 1500) }), T);
    const late = applyPredictionFrame(locked, frame("channel.prediction.progress", { outcomes: outcomes(900, 1500), locks_at: locksAt }), T + 10);
    expect(late?.status).toBe("locked");
    expect(late?.outcomes[0]!.points).toBe(900);
  });

  test("a late progress or lock after the end is ignored", () => {
    const ended = applyPredictionFrame(
      null,
      frame("channel.prediction.end", { outcomes: outcomes(700, 1500), status: "resolved", winning_outcome_id: "2" }),
      T
    );
    expect(applyPredictionFrame(ended, frame("channel.prediction.progress", { outcomes: outcomes(1, 1), locks_at: locksAt }), T + 10)).toBe(ended);
    expect(applyPredictionFrame(ended, frame("channel.prediction.lock", { outcomes: outcomes(1, 1) }), T + 10)).toBe(ended);
  });

  test("a cancel has no winner, even if Twitch sends an empty id", () => {
    const s = applyPredictionFrame(
      null,
      frame("channel.prediction.end", { outcomes: outcomes(700, 1500), status: "canceled", winning_outcome_id: "" }),
      T
    );
    expect(s?.status).toBe("canceled");
    expect(s?.winningOutcomeId).toBeNull();
  });

  test("a new prediction replaces the one that was up", () => {
    const first = applyPredictionFrame(null, frame("channel.prediction.lock", { outcomes: outcomes(700, 1500) }), T);
    const second = applyPredictionFrame(
      first,
      { type: "channel.prediction.begin", payload: { id: "pr2", title: "Next one", outcomes: outcomes(0, 0), locks_at: locksAt } },
      T + 1000
    );
    expect(second?.id).toBe("pr2");
    expect(second?.status).toBe("active");
  });

  test("other events leave the state alone", () => {
    const s = applyPredictionFrame(null, frame("channel.prediction.progress", { outcomes: outcomes(1, 1), locks_at: locksAt }), T);
    expect(applyPredictionFrame(s, { type: "channel.poll.begin", payload: { id: "pr1", choices: [] } }, T)).toBe(s);
    expect(applyPredictionFrame(s, { type: "channel.follow", payload: {} }, T)).toBe(s);
  });

  test("test predictions are told apart by their id", () => {
    expect(isDemoPredictionFrame({ type: "channel.prediction.begin", payload: { id: "demo-prediction" } })).toBe(true);
    expect(isDemoPredictionFrame(frame("channel.prediction.begin", {}))).toBe(false);
  });
});

describe("seedPrediction", () => {
  const fetched = {
    id: "pr1",
    title: "First try?",
    outcomes: outcomes(200, 100),
    status: "active",
    locks_at: new Date(T + 30_000).toISOString(),
    ended_at: null,
    winning_outcome_id: null,
  };

  test("fills an empty widget from Helix", () => {
    const s = seedPrediction(null, fetched);
    expect(s?.status).toBe("active");
    expect(s?.locksAt).toBe(T + 30_000);
  });

  test("an event that already arrived wins", () => {
    const live = applyPredictionFrame(null, frame("channel.prediction.progress", { outcomes: outcomes(9, 1), locks_at: locksAt }), T);
    expect(seedPrediction(live, fetched)).toBe(live);
  });

  test("a locked one comes back locked, with no countdown", () => {
    const s = seedPrediction(null, { ...fetched, status: "locked" });
    expect(s?.status).toBe("locked");
    expect(s?.locksAt).toBeNull();
  });

  test("a just-resolved one keeps its winner and its real end time", () => {
    const s = seedPrediction(null, { ...fetched, status: "resolved", ended_at: new Date(T).toISOString(), winning_outcome_id: "2" });
    expect(s?.status).toBe("resolved");
    expect(s?.winningOutcomeId).toBe("2");
    expect(s?.endedAt).toBe(T);
  });
});

describe("buildPredictionView", () => {
  const cfg = createDefaultPredictionWidgetConfig();
  const snapshot = (a: number, b: number, patch: Partial<PredictionSnapshot> = {}): PredictionSnapshot => ({
    id: "pr1",
    title: "First try?",
    outcomes: [
      { id: "1", title: "Easy clap", points: a, users: 4 },
      { id: "2", title: "Not a chance", points: b, users: 9 },
    ],
    status: "active",
    locksAt: T + 65_000,
    endedAt: null,
    winningOutcomeId: null,
    ...patch,
  });

  test("shares are by channel points, and the countdown runs to the lock", () => {
    const v = buildPredictionView(snapshot(2500, 7500), cfg, T);
    expect(v.choices.map((c) => c.percent)).toEqual([25, 75]);
    expect(v.choices[1]!.votesText).toBe("7,500 points");
    expect(v.totalText).toBe("10,000 points");
    expect(v.leader?.id).toBe("2");
    expect(v.timerText).toBe("1:05");
    expect(v.ended).toBe(false);
  });

  test("locked shows Locked where the countdown was, and is not over yet", () => {
    const v = buildPredictionView(snapshot(2500, 7500, { status: "locked", locksAt: null }), cfg, T);
    expect(v.timerText).toBe("Locked");
    expect(v.ended).toBe(false);
    expect(v.resultText).toBe("");
  });

  test("the winner is the outcome the streamer picked, not the one with the most points", () => {
    const v = buildPredictionView(snapshot(2500, 7500, { status: "resolved", locksAt: null, endedAt: T, winningOutcomeId: "1" }), cfg, T);
    expect(v.resultText).toBe("Easy clap wins");
    expect(v.leader?.id).toBe("1");
    expect(v.choices.map((c) => c.isWinner)).toEqual([true, false]);
    expect(v.choices.map((c) => c.isLeader)).toEqual([true, false]);
    // The points are still the points.
    expect(v.choices.map((c) => c.percent)).toEqual([25, 75]);
  });

  test("leader colouring follows the winner once it is resolved", () => {
    const leaderCfg = { ...cfg, colorMode: "leader" as const };
    const open = buildPredictionView(snapshot(2500, 7500), leaderCfg, T);
    expect(open.choices.map((c) => c.color)).toEqual([cfg.otherColor, cfg.leaderColor]);
    const resolved = buildPredictionView(snapshot(2500, 7500, { status: "resolved", endedAt: T, winningOutcomeId: "1" }), leaderCfg, T);
    expect(resolved.choices.map((c) => c.color)).toEqual([cfg.leaderColor, cfg.otherColor]);
  });

  test("a cancel says Refunded and crowns nobody", () => {
    const v = buildPredictionView(snapshot(2500, 7500, { status: "canceled", locksAt: null, endedAt: T }), cfg, T);
    expect(v.resultText).toBe("Refunded");
    expect(v.choices.some((c) => c.isWinner)).toBe(false);
  });

  test("no points yet: nobody leads, and the wording is about points", () => {
    const v = buildPredictionView(snapshot(0, 0), cfg, T);
    expect(v.leader).toBeNull();
    expect(v.emptyText).toBe("No points yet");
  });

  test("an empty title here falls back to Twitch's", () => {
    expect(buildPredictionView(snapshot(1, 1), cfg, T).title).toBe("First try?");
    expect(buildPredictionView(snapshot(1, 1), { ...cfg, title: "Call it" }, T).title).toBe("Call it");
  });
});

describe("normalizePredictionWidgetConfig", () => {
  test("keeps ten outcome colors and repairs bad ones", () => {
    const cfg = normalizePredictionWidgetConfig({ preset: "donut", choiceColors: ["#fff", "nope"], showWhileLocked: false });
    expect(cfg.preset).toBe("donut");
    expect(cfg.choiceColors).toHaveLength(10);
    expect(cfg.choiceColors[0]).toBe("#fff");
    expect(cfg.choiceColors[1]).toBe(PREDICTION_DEFAULT_OUTCOME_COLORS[1]);
    expect(cfg.choiceColors[9]).toBe(PREDICTION_DEFAULT_OUTCOME_COLORS[9]);
    expect(cfg.showWhileLocked).toBe(false);
  });

  test("the schema defaults to the config the widget is created with", () => {
    expect(predictionWidgetItemConfigSchema.parse({})).toEqual(createDefaultPredictionWidgetConfig());
  });
});
