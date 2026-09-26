import { describe, expect, it } from "bun:test";
import {
  LABEL_CATALOG,
  applyLabelEvent,
  buildDemoLabelSnapshot,
  buildSessionLabels,
  emptyLabelSnapshot,
  emptySessionLabels,
  formatLabelTemplate,
  getLabelDefinition,
  labelTemplateValues,
  latestLabelColumns,
  latestLabelsFromRow,
  labelPeriodStart,
  resolveLabel,
  type LabelSnapshot,
} from "./stream-labels";

const NOW = "2026-09-25T12:00:00.000Z";
const user = (id: string, name: string) => ({ user_id: id, user_login: name.toLowerCase(), user_name: name });

function live(): LabelSnapshot {
  return { ...emptyLabelSnapshot(), broadcaster_id: "1", session: emptySessionLabels("s1", true), helix: { followers: 10, subscribers: 2, sub_points: 2 } };
}

function run(events: [string, Record<string, unknown>][], start = live()) {
  return events.reduce((snap, [type, event]) => applyLabelEvent(snap, type, event, { at: NOW }), start);
}

describe("applyLabelEvent", () => {
  it("moves latest, recent, the feed, the session count and the Helix total for a follow", () => {
    const snap = run([["channel.follow", { ...user("5", "Pixel"), followed_at: NOW }]]);
    expect(snap.latest.follower).toMatchObject({ kind: "follow", name: "Pixel", at: NOW });
    expect(snap.session.recent.followers).toHaveLength(1);
    expect(snap.session.recent.events).toHaveLength(1);
    expect(snap.session.counts.followers).toBe(1);
    expect(snap.helix.followers).toBe(11);
  });

  it("only moves latest and Helix while offline", () => {
    const offline = { ...live(), session: emptySessionLabels("s1", false) };
    const snap = run([["channel.follow", user("5", "Pixel")]], offline);
    expect(snap.latest.follower?.name).toBe("Pixel");
    expect(snap.session).toBe(offline.session);
    expect(snap.helix.followers).toBe(11);
  });

  it("counts gift recipients but only lists the gifter", () => {
    const snap = run([
      ["channel.subscription.gift", { ...user("9", "Gifter"), total: 3, tier: "1000", is_anonymous: false }],
      ["channel.subscribe", { ...user("10", "A"), is_gift: true }],
      ["channel.subscribe", { ...user("11", "B"), is_gift: true }],
      ["channel.subscribe", { ...user("12", "C"), is_gift: true }],
    ]);
    expect(snap.session.counts.subscribers).toBe(3);
    expect(snap.session.counts.gifts).toBe(3);
    expect(snap.session.recent.events).toHaveLength(1);
    expect(snap.latest.subscriber).toBeUndefined();
    expect(snap.session.leaders.gifts).toEqual([{ id: "9", login: "gifter", name: "Gifter", amount: 3 }]);
  });

  it("keeps anonymous cheers off the top list", () => {
    const snap = run([["channel.cheer", { is_anonymous: true, user_id: null, bits: 100 }]]);
    expect(snap.latest.cheer).toMatchObject({ name: "Anonymous", amount: 100, id: null });
    expect(snap.session.leaders.bits).toEqual([]);
    expect(snap.session.counts.bits).toBe(100);
  });

  it("keeps the biggest cheer and sums the top cheerers", () => {
    const snap = run([
      ["channel.cheer", { ...user("1a", "Moon"), bits: 500 }],
      ["channel.cheer", { ...user("2b", "Sun"), bits: 100 }],
      ["channel.cheer", { ...user("2b", "Sun"), bits: 450 }],
    ]);
    expect(snap.session.top.cheer).toMatchObject({ name: "Moon", amount: 500 });
    expect(snap.session.leaders.bits.map((l) => [l.name, l.amount])).toEqual([["Sun", 550], ["Moon", 500]]);
  });

  it("ignores outgoing raids", () => {
    const snap = run([["channel.raid", { from_broadcaster_user_id: "1", from_broadcaster_user_name: "Me", to_broadcaster_user_id: "99", viewers: 5 }]]);
    expect(snap.latest.raid).toBeUndefined();
  });

  it("counts a hype train once and keeps its highest level", () => {
    const snap = run([
      ["channel.hype_train.begin", { level: 1 }],
      ["channel.hype_train.progress", { level: 3 }],
      ["channel.hype_train.end", { level: 3 }],
    ]);
    expect(snap.session.counts.hype_trains).toBe(1);
    expect(snap.session.top.hype_level).toMatchObject({ amount: 3 });
    expect(snap.latest.hype_train).toMatchObject({ active: false });
  });

  it("returns the same snapshot for events that move nothing", () => {
    const start = live();
    expect(applyLabelEvent(start, "channel.chat.message", { text: "hi" })).toBe(start);
    expect(applyLabelEvent(start, "channel.follow", {})).toBe(start);
  });
});

describe("server side", () => {
  it("builds a session from rows the same way the client applies events", () => {
    const rows = [
      { event_type: "channel.follow", event_data: user("1", "A"), created_at: NOW },
      { event_type: "channel.cheer", event_data: { ...user("2", "B"), bits: 50 }, created_at: NOW },
    ];
    const session = buildSessionLabels(rows, { stream_id: "s1", is_live: false, broadcaster_id: "1" });
    expect(session.counts).toMatchObject({ followers: 1, bits: 50 });
    expect(session.is_live).toBe(false);
  });

  it("maps an event to stream_labels columns and back", () => {
    const cols = latestLabelColumns("channel.subscription.message", { ...user("3", "C"), cumulative_months: 4 }, "1");
    expect(Object.keys(cols ?? {}).sort()).toEqual(["latest_resubscriber", "latest_subscriber"]);
    expect(latestLabelsFromRow(cols).resubscriber?.months).toBe(4);
    expect(latestLabelColumns("channel.subscribe", { ...user("3", "C"), is_gift: true })).toBeNull();
  });
});

describe("catalog", () => {
  it("resolves every label against the demo snapshot", () => {
    const snap = buildDemoLabelSnapshot(0);
    for (const def of LABEL_CATALOG) {
      const r = resolveLabel(snap, def);
      const empty =
        (r.shape === "entry" && !r.entry) ||
        (r.shape === "number" && !r.value) ||
        ((r.shape === "list" || r.shape === "leaders") && r.items.length === 0);
      expect({ id: def.id, empty }).toEqual({ id: def.id, empty: false });
    }
  });

  it("has unique ids", () => {
    expect(new Set(LABEL_CATALOG.map((d) => d.id)).size).toBe(LABEL_CATALOG.length);
  });

  it("formats templates", () => {
    const resub = buildDemoLabelSnapshot(0).latest.resubscriber;
    if (!resub) throw new Error("no resub");
    expect(formatLabelTemplate("{name} ({months} months)", labelTemplateValues(resub))).toBe("GrumpyCatto (14 months)");
    const r = resolveLabel(buildDemoLabelSnapshot(0), getLabelDefinition("top_cheerer"));
    expect(r.shape === "leaders" && r.items.map((l) => l.name)).toEqual(["NineToad"]);
    expect(formatLabelTemplate("{name} ({months})", { name: "X" })).toBe("X");
    expect(formatLabelTemplate("{amount}", { amount: 12345 }, "en-US")).toBe("12,345");
  });
});

describe("periods", () => {
  // Thursday 2026-09-24 15:00 UTC.
  const now = Date.parse("2026-09-24T15:00:00.000Z");

  it("starts periods on UTC calendar boundaries, weeks on Monday", () => {
    const session = { started_at: "2026-09-24T12:00:00.000Z" };
    expect(new Date(labelPeriodStart("day", session, now)!).toISOString()).toBe("2026-09-24T00:00:00.000Z");
    expect(new Date(labelPeriodStart("week", session, now)!).toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(new Date(labelPeriodStart("month", session, now)!).toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(new Date(labelPeriodStart("year", session, now)!).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(labelPeriodStart("stream", session, now)).toBe(Date.parse(session.started_at));
    expect(labelPeriodStart("all", session, now)).toBeNull();
    expect(labelPeriodStart("stream", { started_at: null }, now)).toBeNull();
  });

  it("hides a latest entry from before the period", () => {
    const snap: LabelSnapshot = {
      ...live(),
      latest: { follower: { kind: "follow", name: "Old", at: "2026-09-20T10:00:00.000Z" } },
    };
    const def = getLabelDefinition("latest_follower");
    expect(resolveLabel(snap, def, "all", now)).toMatchObject({ entry: { name: "Old" } });
    expect(resolveLabel(snap, def, "month", now)).toMatchObject({ entry: { name: "Old" } });
    expect(resolveLabel(snap, def, "week", now)).toEqual({ shape: "entry", entry: null });
  });

  it("cuts the event history at the period start", () => {
    const e = (name: string, at: string) => ({ kind: "follow" as const, name, at });
    const snap: LabelSnapshot = {
      ...live(),
      history: [e("Today", "2026-09-24T09:00:00.000Z"), e("Monday", "2026-09-21T09:00:00.000Z"), e("August", "2026-08-30T09:00:00.000Z")],
    };
    const def = getLabelDefinition("event_list");
    const names = (p: "day" | "week" | "month" | "all") => {
      const r = resolveLabel(snap, def, p, now);
      return r.shape === "list" ? r.items.map((i) => i.name) : [];
    };
    expect(names("day")).toEqual(["Today"]);
    expect(names("week")).toEqual(["Today", "Monday"]);
    expect(names("month")).toEqual(["Today", "Monday"]);
    expect(names("all")).toEqual(["Today", "Monday", "August"]);
  });

  it("reads top cheerers per period and adds live cheers to every period", () => {
    const start: LabelSnapshot = {
      ...live(),
      period_leaders: {
        day: [],
        week: [{ id: "7", login: "moon", name: "Moon", amount: 100 }],
        month: [{ id: "7", login: "moon", name: "Moon", amount: 900 }],
        year: [],
        all: [],
      },
    };
    const snap = run([["channel.cheer", { ...user("8", "Sun"), bits: 300 }]], start);
    const top = (p: "day" | "week" | "month" | "stream") => {
      const r = resolveLabel(snap, getLabelDefinition("top_cheerer"), p, now);
      return r.shape === "leaders" ? r.items.map((l) => `${l.name}:${l.amount}`) : [];
    };
    expect(top("day")).toEqual(["Sun:300"]);
    expect(top("week")).toEqual(["Sun:300"]);
    expect(top("month")).toEqual(["Moon:900"]);
    expect(top("stream")).toEqual(["Sun:300"]);
  });

  it("ignores the period for labels without a filter", () => {
    const r = resolveLabel(live(), getLabelDefinition("follower_count"), "day", now);
    expect(r).toEqual({ shape: "number", value: 10 });
  });
});
