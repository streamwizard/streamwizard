import { describe, expect, it } from "bun:test";
import { hypeTrainWidgetItemConfigSchema } from "../../../../overlay-schemas";
import {
  EMPTY_HYPE_TRAIN_STATE,
  HYPE_TRAIN_EXPIRY_GRACE_MS,
  HYPE_TRAIN_LEAD_IN_MS,
  applyAvatars,
  applyHypeTrainFrame,
  expireHypeTrain,
  formatRiderAmount,
  hypeTrainGone,
  rankRiders,
  type HypeTrainFrame,
  type HypeTrainState,
} from "./hype-train-engine";
import {
  createDefaultHypeTrainWidgetConfig,
  hypeTrainSpeed,
  normalizeHypeTrainWidgetConfig,
} from "./hype-train-widget-config";

function train(
  type: "begin" | "progress" | "end",
  level: number,
  id = "t1",
  top: unknown[] = [],
  extra: Record<string, unknown> = {},
): HypeTrainFrame {
  return { type: `channel.hype_train.${type}`, payload: { id, level, type: "regular", top_contributions: top, ...extra } };
}

const cheer = (id: string, bits: number): HypeTrainFrame => ({
  type: "channel.cheer",
  payload: { user_id: id, user_login: id, user_name: id.toUpperCase(), bits, is_anonymous: false },
});

function run(frames: HypeTrainFrame[], start = 0, state: HypeTrainState = EMPTY_HYPE_TRAIN_STATE) {
  let s = state;
  frames.forEach((f, i) => {
    s = applyHypeTrainFrame(s, f, start + i * 1000);
  });
  return s;
}

describe("hype train config", () => {
  it("defaults survive a schema round trip", () => {
    const defaults = createDefaultHypeTrainWidgetConfig();
    expect(hypeTrainWidgetItemConfigSchema.parse(defaults)).toEqual(defaults);
  });

  it("clamps and falls back on bad values", () => {
    const cfg = normalizeHypeTrainWidgetConfig({ speed: 99999, maxWagons: 0, preset: "rocket", trainColor: "red" });
    expect(cfg.speed).toBe(1500);
    expect(cfg.maxWagons).toBe(1);
    expect(cfg.preset).toBe("steam");
    expect(cfg.trainColor).toBe("#7c5cff");
  });
});

describe("hype train speed", () => {
  it("speeds up per level above 1", () => {
    expect(hypeTrainSpeed({ speed: 400, speedPerLevel: 15 }, 1)).toBe(400);
    expect(hypeTrainSpeed({ speed: 400, speedPerLevel: 15 }, 5)).toBe(640);
  });

  it("stays put at 0% and never passes the top speed", () => {
    expect(hypeTrainSpeed({ speed: 400, speedPerLevel: 0 }, 9)).toBe(400);
    expect(hypeTrainSpeed({ speed: 1500, speedPerLevel: 50 }, 25)).toBe(3000);
  });
});

describe("hype train engine", () => {
  it("rolls in on begin and stays until it has driven off after the end", () => {
    let s = run([train("begin", 1)]);
    expect(s.active).toBe(true);
    expect(s.showing).toBe(true);
    s = run([train("progress", 2), train("end", 3)], 1000, s);
    expect(s.active).toBe(false);
    expect(s.showing).toBe(true);
    expect(s.level).toBe(3);
    // A ride from another train can't clear this one.
    expect(hypeTrainGone(s, s.rideKey - 1)).toBe(s);
    expect(hypeTrainGone(s, s.rideKey).showing).toBe(false);
  });

  it("keeps showing while the train runs, whatever the renderer reports", () => {
    const s = run([train("begin", 1)]);
    expect(hypeTrainGone(s, s.rideKey)).toBe(s);
  });

  it("collects everyone who contributes, in the order they joined", () => {
    const s = run([train("begin", 1), cheer("a", 100), cheer("b", 300), cheer("a", 50)]);
    expect(s.riders.map((r) => [r.id, r.bits])).toEqual([
      ["a", 150],
      ["b", 300],
    ]);
  });

  it("counts the lead-in contributions that started the train, but not stale ones", () => {
    let s = applyHypeTrainFrame(EMPTY_HYPE_TRAIN_STATE, cheer("old", 100), 0);
    s = applyHypeTrainFrame(s, cheer("fresh", 100), HYPE_TRAIN_LEAD_IN_MS);
    s = applyHypeTrainFrame(s, train("begin", 1), HYPE_TRAIN_LEAD_IN_MS + 1000);
    expect(s.riders.map((r) => r.id)).toEqual(["fresh"]);
  });

  it("merges top contributions without double counting", () => {
    const top = [{ user_id: "a", user_login: "a", user_name: "A", type: "bits", total: 500 }];
    const s = run([train("begin", 1), cheer("a", 200), train("progress", 1, "t1", top)]);
    expect(s.riders).toHaveLength(1);
    expect(s.riders[0]!.bits).toBe(500);
  });

  it("turns subs and gifts into sub counts", () => {
    const s = run([
      train("begin", 1),
      { type: "channel.subscribe", payload: { user_id: "s", user_login: "s", user_name: "S", tier: "1000", is_gift: false } },
      { type: "channel.subscribe", payload: { user_id: "r", user_login: "r", user_name: "R", tier: "1000", is_gift: true } },
      { type: "channel.subscription.gift", payload: { user_id: "g", user_login: "g", user_name: "G", tier: "2000", total: 5, is_anonymous: false } },
      { type: "channel.subscription.gift", payload: { user_id: null, user_login: null, user_name: null, tier: "1000", total: 2, is_anonymous: true } },
    ]);
    expect(s.riders.map((r) => [r.id, r.subs, r.subPoints])).toEqual([
      ["s", 1, 500],
      ["g", 5, 5000],
      ["anonymous", 2, 1000],
    ]);
  });

  it("ignores a repeated begin for the same train", () => {
    const s = run([train("begin", 1), cheer("a", 100)]);
    expect(applyHypeTrainFrame(s, train("begin", 1), 5000)).toBe(s);
  });

  it("starts fresh on a new train", () => {
    const s = run([train("begin", 1), cheer("a", 100), train("end", 1), train("begin", 1, "t2")]);
    expect(s.trainId).toBe("t2");
    expect(s.riders).toEqual([]);
  });

  it("picks up a train already running when the overlay loads mid-way", () => {
    const top = [{ user_id: "a", user_login: "a", user_name: "A", type: "subscription", total: 1500 }];
    const s = run([train("progress", 3, "t9", top)]);
    expect(s.active).toBe(true);
    expect(s.showing).toBe(true);
    expect(s.level).toBe(3);
    expect(s.riders[0]!.subs).toBe(3);
  });

  it("shows nothing for an end it never saw start", () => {
    expect(run([train("end", 2)])).toBe(EMPTY_HYPE_TRAIN_STATE);
  });

  it("ignores contributions after the end apart from the next lead-in", () => {
    const s = run([train("begin", 1), train("end", 1), cheer("late", 100)]);
    expect(s.riders.map((r) => r.id)).toEqual([]);
    expect(s.recent).toHaveLength(1);
  });

  it("ends a train whose end never came, after its expiry", () => {
    const expires = new Date(60_000).toISOString();
    const s = run([train("begin", 1, "t1", [], { expires_at: expires })]);
    expect(s.expiresAt).toBe(60_000);
    expect(expireHypeTrain(s, 60_000)).toBe(s);
    const expired = expireHypeTrain(s, 60_000 + HYPE_TRAIN_EXPIRY_GRACE_MS);
    expect(expired.active).toBe(false);
    expect(expired.showing).toBe(true);
  });

  it("pushes the expiry back on progress", () => {
    let s = run([train("begin", 1, "t1", [], { expires_at: new Date(60_000).toISOString() })]);
    s = applyHypeTrainFrame(s, train("progress", 1, "t1", [], { expires_at: new Date(120_000).toISOString() }), 50_000);
    expect(s.expiresAt).toBe(120_000);
  });

  it("fills in avatars", () => {
    const s = applyAvatars(run([train("begin", 1), cheer("12345", 100)]), { "12345": "https://x/a.png" });
    expect(s.riders[0]!.avatar).toBe("https://x/a.png");
    expect(applyAvatars(s, {})).toBe(s);
  });

  it("ranks riders by support, ties in join order, keeping their join index", () => {
    const s = run([train("begin", 1), cheer("a", 100), cheer("b", 500), cheer("c", 100)]);
    expect(rankRiders(s.riders).map((r) => [r.rider.id, r.joinIndex])).toEqual([
      ["b", 1],
      ["a", 0],
      ["c", 2],
    ]);
    const later = applyHypeTrainFrame(s, cheer("c", 1000), 9000);
    expect(rankRiders(later.riders).map((r) => r.rider.id)).toEqual(["c", "b", "a"]);
  });

  it("formats amounts", () => {
    const base = { id: "x", login: "x", name: "X", avatar: null, subPoints: 0, other: 0, joinedAt: 0 };
    expect(formatRiderAmount({ ...base, bits: 1200, subs: 3 })).toBe("1.2K bits · 3 subs");
    expect(formatRiderAmount({ ...base, bits: 0, subs: 1 })).toBe("1 sub");
    expect(formatRiderAmount({ ...base, bits: 0, subs: 0 })).toBe("");
  });
});
