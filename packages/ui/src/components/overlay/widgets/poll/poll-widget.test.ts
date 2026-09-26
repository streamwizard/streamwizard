import { describe, expect, test } from "bun:test";
import { createDefaultPollWidgetConfig, normalizePollWidgetConfig } from "./poll-widget-config";
import { buildPollView, formatPollTimer } from "./poll-view";
import { applyPollFrame, seedPoll, type PollSnapshot } from "./poll-widget-state";

const T = Date.parse("2026-09-24T12:00:00Z");
const choices = (a: number, b: number, c?: number) => [
  { id: "1", title: "Hard socks", votes: a, channel_points_votes: 0, bits_votes: 0 },
  { id: "2", title: "Absolutely not", votes: b, channel_points_votes: 0, bits_votes: 0 },
  ...(c === undefined ? [] : [{ id: "3", title: "Depends", votes: c, channel_points_votes: 0, bits_votes: 0 }]),
];
const frame = (type: string, payload: Record<string, unknown>) => ({ type, payload: { id: "p1", title: "Shoes?", ...payload } });

describe("applyPollFrame", () => {
  test("begin, progress and end walk one poll through", () => {
    let s = applyPollFrame(null, frame("channel.poll.begin", { choices: [{ id: "1", title: "A" }, { id: "2", title: "B" }], ends_at: new Date(T + 60_000).toISOString() }), T);
    expect(s?.status).toBe("active");
    expect(s?.choices.map((c) => c.votes)).toEqual([0, 0]);
    expect(s?.endsAt).toBe(T + 60_000);
    s = applyPollFrame(s, frame("channel.poll.progress", { choices: choices(3, 1), ends_at: new Date(T + 60_000).toISOString() }), T + 1000);
    expect(s?.choices[0]!.votes).toBe(3);
    s = applyPollFrame(s, frame("channel.poll.end", { choices: choices(5, 2), status: "completed" }), T + 2000);
    expect(s?.endedAt).toBe(T + 2000);
    expect(s?.status).toBe("completed");
  });

  test("a late progress after the end is ignored", () => {
    const ended = applyPollFrame(null, frame("channel.poll.end", { choices: choices(5, 2), status: "completed" }), T);
    expect(applyPollFrame(ended, frame("channel.poll.progress", { choices: choices(4, 2), ends_at: "x" }), T + 10)).toBe(ended);
  });

  test("an archived poll disappears at once", () => {
    const running = applyPollFrame(null, frame("channel.poll.progress", { choices: choices(1, 1) }), T);
    expect(applyPollFrame(running, frame("channel.poll.end", { choices: choices(1, 1), status: "archived" }), T)).toBeNull();
  });

  test("other events leave the state alone", () => {
    const s = applyPollFrame(null, frame("channel.poll.progress", { choices: choices(1, 1) }), T);
    expect(applyPollFrame(s, { type: "channel.follow", payload: {} }, T)).toBe(s);
  });
});

describe("seedPoll", () => {
  const fetched = { id: "p1", title: "Shoes?", choices: choices(2, 1), status: "active", ends_at: new Date(T + 30_000).toISOString(), ended_at: null };

  test("fills an empty widget from Helix", () => {
    expect(seedPoll(null, fetched)?.endsAt).toBe(T + 30_000);
  });

  test("an event that already arrived wins", () => {
    const live = applyPollFrame(null, frame("channel.poll.progress", { choices: choices(9, 1) }), T);
    expect(seedPoll(live, fetched)).toBe(live);
  });

  test("a just-ended poll keeps its real end time", () => {
    const ended = { ...fetched, status: "completed", ended_at: new Date(T).toISOString() };
    expect(seedPoll(null, ended)?.endedAt).toBe(T);
  });
});

describe("buildPollView", () => {
  const cfg = createDefaultPollWidgetConfig();
  const poll = (a: number, b: number, c: number, ended = false): PollSnapshot => ({
    id: "p1",
    title: "Shoes?",
    choices: choices(a, b, c).map(({ id, title, votes }) => ({ id, title, votes })),
    status: ended ? "completed" : "active",
    endsAt: ended ? null : T + 65_000,
    endedAt: ended ? T : null,
  });

  test("floored percentages never pass 100", () => {
    const v = buildPollView(poll(41, 40, 12), cfg, T);
    expect(v.choices.map((c) => c.percent)).toEqual([44, 43, 12]);
    expect(v.choices.reduce((s, c) => s + c.percent, 0)).toBeLessThanOrEqual(100);
    expect(v.leader?.id).toBe("1");
    expect(v.timerText).toBe("1:05");
  });

  test("no votes: nobody leads, everything at zero", () => {
    const v = buildPollView(poll(0, 0, 0), cfg, T);
    expect(v.leader).toBeNull();
    expect(v.choices.every((c) => c.percent === 0 && c.relative === 0)).toBe(true);
  });

  test("the winner, a tie and no votes at the end", () => {
    expect(buildPollView(poll(5, 2, 1, true), cfg, T).resultText).toBe("Hard socks wins");
    const tie = buildPollView(poll(3, 3, 1, true), cfg, T);
    expect(tie.resultText).toBe("Tie");
    expect(tie.choices.filter((c) => c.isWinner).map((c) => c.id)).toEqual(["1", "2"]);
    expect(buildPollView(poll(0, 0, 0, true), cfg, T).resultText).toBe("No votes");
  });

  test("leader colouring mutes everyone but the leader", () => {
    const v = buildPollView(poll(5, 2, 1), { ...cfg, colorMode: "leader" }, T);
    expect(v.choices.map((c) => c.color)).toEqual([cfg.leaderColor, cfg.otherColor, cfg.otherColor]);
  });

  test("an empty title here falls back to Twitch's; both empty shows none", () => {
    expect(buildPollView(poll(1, 1, 1), cfg, T).title).toBe("Shoes?");
    expect(buildPollView(poll(1, 1, 1), { ...cfg, title: "Pick one" }, T).title).toBe("Pick one");
    expect(buildPollView({ ...poll(1, 1, 1), title: " " }, cfg, T).title).toBe("");
  });

  test("timer format", () => {
    expect(formatPollTimer(0)).toBe("0:00");
    expect(formatPollTimer(59.2)).toBe("1:00");
    expect(formatPollTimer(125)).toBe("2:05");
  });
});

describe("normalizePollWidgetConfig", () => {
  test("fills a partial row and repairs bad colours", () => {
    const cfg = normalizePollWidgetConfig({ preset: "donut", choiceColors: ["#fff", "nope"], hideAfterSeconds: 999 });
    expect(cfg.preset).toBe("donut");
    expect(cfg.choiceColors).toHaveLength(5);
    expect(cfg.choiceColors[0]).toBe("#fff");
    expect(cfg.choiceColors[1]).toBe("#fe8bbb");
    expect(cfg.hideAfterSeconds).toBe(60);
  });
});
