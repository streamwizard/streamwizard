import { describe, expect, test } from "bun:test";
import { extractReceivingBroadcasterId } from "./receiving-broadcaster";

/**
 * channel.shoutout.create carries to_broadcaster_user_id = the channel being
 * shouted out. The old helper took that field first for every event type, so
 * streamer A's shoutout of B landed on B's overlays and B's event log.
 */
describe("extractReceivingBroadcasterId", () => {
  test("a shoutout belongs to the subscribed channel, not the target", () => {
    const event = { broadcaster_user_id: "A", to_broadcaster_user_id: "B", moderator_user_id: "A" };
    expect(extractReceivingBroadcasterId("channel.shoutout.create", { broadcaster_user_id: "A", moderator_user_id: "A" }, event)).toBe("A");
    // Even without a condition, the body fallback no longer picks the target.
    expect(extractReceivingBroadcasterId("channel.shoutout.create", undefined, event)).toBe("A");
  });

  test("an incoming raid belongs to the raided channel", () => {
    const event = { from_broadcaster_user_id: "A", to_broadcaster_user_id: "B" };
    expect(extractReceivingBroadcasterId("channel.raid", { to_broadcaster_user_id: "B" }, event)).toBe("B");
    expect(extractReceivingBroadcasterId("channel.raid", undefined, event)).toBe("B");
  });

  test("ordinary events use the condition's broadcaster", () => {
    expect(extractReceivingBroadcasterId("channel.follow", { broadcaster_user_id: "C", moderator_user_id: "C" }, { broadcaster_user_id: "C", user_id: "viewer" })).toBe("C");
  });

  test("condition keys are tried in order and empty values are skipped", () => {
    expect(extractReceivingBroadcasterId("channel.raid", { to_broadcaster_user_id: "", from_broadcaster_user_id: "F" }, {})).toBe("F");
    expect(extractReceivingBroadcasterId("user.authorization.revoke", { user_id: "U" }, {})).toBe("U");
    expect(extractReceivingBroadcasterId("channel.follow", null, { broadcaster_user_id: "C" })).toBe("C");
  });

  test("falls back to the first data entry", () => {
    expect(extractReceivingBroadcasterId("channel.goal.progress", undefined, { data: [{ broadcaster_user_id: "D" }] })).toBe("D");
    expect(extractReceivingBroadcasterId("channel.raid", undefined, { data: [{ to_broadcaster_user_id: "R", broadcaster_user_id: "X" }] })).toBe("R");
  });

  test("user-scoped events without a condition fall back to the body user_id", () => {
    expect(extractReceivingBroadcasterId("user.authorization.revoke", undefined, { user_id: "U", client_id: "c" })).toBe("U");
  });

  test("the broadcaster wins over the body user_id", () => {
    expect(extractReceivingBroadcasterId("channel.follow", undefined, { broadcaster_user_id: "C", user_id: "viewer" })).toBe("C");
  });

  test("returns null when nothing matches", () => {
    expect(extractReceivingBroadcasterId("channel.follow", undefined, {})).toBeNull();
    expect(extractReceivingBroadcasterId("channel.follow", {}, { data: [] })).toBeNull();
  });
});
