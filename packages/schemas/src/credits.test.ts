import { describe, expect, it } from "bun:test";
import {
  CREDITS_ANONYMOUS_NAME,
  aggregateCredits,
  buildDemoCreditsData,
  creditsDataSchema,
  emptyCredits,
  type CreditsEventRow,
  type CreditsStreamMeta,
} from "./credits";

const STARTED = "2026-09-24T18:00:00.000Z";
const NOW = Date.parse("2026-09-24T21:30:00.000Z");

const meta: CreditsStreamMeta = {
  stream_id: "s1",
  broadcaster_id: "2",
  is_live: false,
  started_at: STARTED,
  peak_viewers: 40,
  now: NOW,
};

function row(event_type: string, event_data: Record<string, unknown>, offset = 60): CreditsEventRow {
  return {
    event_type,
    event_data,
    created_at: new Date(Date.parse(STARTED) + offset * 1000).toISOString(),
    offset_seconds: offset,
  };
}

function user(id: string, name = `user${id}`) {
  return { user_id: id, user_login: name.toLowerCase(), user_name: name };
}

describe("aggregateCredits", () => {
  it("counts a gift bomb once, under the gifter", () => {
    const rows = [
      row("channel.subscription.gift", { ...user("9", "Gifter"), total: 5, is_anonymous: false }),
      ...["11", "12", "13", "14", "15"].map((id) => row("channel.subscribe", { ...user(id), is_gift: true })),
    ];
    const data = aggregateCredits(rows, meta);
    expect(data.gifters).toEqual([{ user_id: "9", login: "gifter", name: "Gifter", value: 5 }]);
    expect(data.counts.gift_subs).toBe(5);
    expect(data.subs).toEqual([]);
    expect(data.counts.subs).toBe(0);
  });

  it("folds anonymous gifts and cheers into one entry each, placed last", () => {
    const rows = [
      row("channel.cheer", { ...user("1"), bits: 100, is_anonymous: false }),
      row("channel.cheer", { user_id: null, user_login: null, user_name: null, bits: 300, is_anonymous: true }),
      row("channel.cheer", { user_id: null, user_login: null, user_name: null, bits: 200, is_anonymous: true }),
      row("channel.subscription.gift", { user_id: null, user_login: null, user_name: null, total: 2, is_anonymous: true }),
    ];
    const data = aggregateCredits(rows, meta);
    expect(data.cheerers.map((c) => [c.name, c.value])).toEqual([
      ["user1", 100],
      [CREDITS_ANONYMOUS_NAME, 500],
    ]);
    expect(data.cheerers[1]!.user_id).toBeNull();
    expect(data.counts.bits).toBe(600);
    expect(data.gifters).toEqual([{ user_id: null, login: null, name: CREDITS_ANONYMOUS_NAME, value: 2 }]);
  });

  it("lists a follower once, in the order they arrived", () => {
    const rows = [
      row("channel.follow", user("1", "First"), 10),
      row("channel.follow", user("2", "Second"), 20),
      row("channel.follow", user("1", "First"), 30),
    ];
    const data = aggregateCredits(rows, meta);
    expect(data.followers.map((f) => f.name)).toEqual(["First", "Second"]);
    expect(data.counts.followers).toBe(2);
  });

  it("puts someone who resubbed under resubs only, keeping their highest month count", () => {
    const rows = [
      row("channel.subscribe", { ...user("1"), is_gift: false }, 10),
      row("channel.subscription.message", { ...user("1"), cumulative_months: 6 }, 20),
      row("channel.subscription.message", { ...user("1"), cumulative_months: 7 }, 30),
      row("channel.subscription.message", { ...user("2"), cumulative_months: 2 }, 40),
      row("channel.subscribe", { ...user("2"), is_gift: false }, 50),
      row("channel.subscribe", { ...user("3"), is_gift: false }, 60),
    ];
    const data = aggregateCredits(rows, meta);
    expect(data.subs.map((s) => s.user_id)).toEqual(["3"]);
    expect(data.resubs.map((s) => [s.user_id, s.value])).toEqual([
      ["1", 7],
      ["2", 2],
    ]);
    expect(data.counts.subs).toBe(1);
    expect(data.counts.resubs).toBe(2);
  });

  it("keeps incoming raids only and merges a repeat raider", () => {
    const raid = (from: string, to: string, viewers: number) => ({
      from_broadcaster_user_id: from,
      from_broadcaster_user_login: `r${from}`,
      from_broadcaster_user_name: `R${from}`,
      to_broadcaster_user_id: to,
      viewers,
    });
    const rows = [
      row("channel.raid", raid("7", "2", 40), 10),
      row("channel.raid", raid("2", "99", 500), 20),
      row("channel.raid", raid("7", "2", 10), 30),
    ];
    const data = aggregateCredits(rows, meta);
    expect(data.raids).toEqual([{ user_id: "7", login: "r7", name: "R7", value: 50 }]);
    expect(data.counts.raids).toBe(2);
  });

  it("counts redemptions per person and sorts the busiest first", () => {
    const rows = [
      row("channel.channel_points_custom_reward_redemption.add", user("1"), 10),
      row("channel.channel_points_custom_reward_redemption.add", user("2"), 20),
      row("channel.channel_points_custom_reward_redemption.add", user("2"), 30),
      row("channel.channel_points_custom_reward_redemption.update", user("3"), 40),
    ];
    const data = aggregateCredits(rows, meta);
    expect(data.redeemers.map((r) => [r.user_id, r.value])).toEqual([
      ["2", 2],
      ["1", 1],
    ]);
    expect(data.counts.redemptions).toBe(3);
  });

  it("counts hype trains by id and keeps the top level", () => {
    const rows = [
      row("channel.hype_train.begin", { id: "a", level: 1, total: 100 }, 10),
      row("channel.hype_train.progress", { id: "a", level: 3, total: 900 }, 20),
      row("channel.hype_train.end", { id: "a", level: 3, total: 1000 }, 30),
      row("channel.hype_train.end", { id: "b", level: 5, total: 4000 }, 40),
    ];
    const data = aggregateCredits(rows, meta);
    expect(data.hype_train).toEqual({ count: 2, top_level: 5, top_total: 4000 });
    expect(data.counts.hype_trains).toBe(2);
    expect(aggregateCredits([], meta).hype_train).toBeNull();
  });

  it("takes the end time from stream.offline", () => {
    const rows = [row("channel.follow", user("1"), 10), row("stream.offline", { broadcaster_user_id: "2" }, 7200)];
    const data = aggregateCredits(rows, meta);
    expect(data.ended_at).toBe(new Date(Date.parse(STARTED) + 7200 * 1000).toISOString());
    expect(data.duration_seconds).toBe(7200);
  });

  it("falls back to the last event when offline never landed", () => {
    const data = aggregateCredits([row("channel.follow", user("1"), 500)], meta);
    expect(data.duration_seconds).toBe(500);
  });

  it("measures a live stream up to now", () => {
    const data = aggregateCredits([row("channel.follow", user("1"), 10)], { ...meta, is_live: true });
    expect(data.is_live).toBe(true);
    expect(data.ended_at).toBeNull();
    expect(data.duration_seconds).toBe(Math.floor((NOW - Date.parse(STARTED)) / 1000));
  });

  it("flags a stream with no events and no viewer samples", () => {
    const data = aggregateCredits([], { ...meta, peak_viewers: null });
    expect(data.missing).toEqual({ stream: false, events: true, viewers: true });
    expect(data.followers).toEqual([]);
    expect(creditsDataSchema.safeParse(data).success).toBe(true);
  });

  it("marks a channel with no stream at all", () => {
    const data = emptyCredits("stream");
    expect(data.missing.stream).toBe(true);
    expect(data.stream_id).toBeNull();
    expect(creditsDataSchema.safeParse(data).success).toBe(true);
  });
});

describe("buildDemoCreditsData", () => {
  it("passes the schema and fills every section", () => {
    const data = buildDemoCreditsData(NOW);
    expect(creditsDataSchema.safeParse(data).success).toBe(true);
    expect(data.followers.length).toBeGreaterThan(30);
    expect(data.subs.length).toBeGreaterThan(0);
    expect(data.resubs.length).toBeGreaterThan(0);
    expect(data.gifters.at(-1)?.name).toBe(CREDITS_ANONYMOUS_NAME);
    expect(data.cheerers[0]?.value).toBe(1750);
    expect(data.raids.length).toBe(2);
    expect(data.redeemers[0]?.value).toBe(3);
    expect(data.hype_train?.top_level).toBe(4);
    expect(data.duration_seconds).toBe(3 * 3600 + 12 * 60);
    expect(data.peak_viewers).toBe(87);
  });

  it("is the same every time for the same clock", () => {
    expect(buildDemoCreditsData(NOW)).toEqual(buildDemoCreditsData(NOW));
  });
});
