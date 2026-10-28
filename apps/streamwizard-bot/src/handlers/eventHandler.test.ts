import { describe, expect, mock, test } from "bun:test";

// The registry wires real handlers and clients at import; only the pure
// helper is under test here.
mock.module("./twitch", () => ({ registerTwitchHandlers: () => {} }));
mock.module("@repo/logger", () => ({ streamEventsLogger: { logTwitchEvent: async () => {} } }));
mock.module("../functions/broadcastOverlayEvent", () => ({ broadcastOverlayEvent: async () => {} }));
mock.module("../functions/recordStreamLabels", () => ({ recordStreamLabels: async () => {} }));
mock.module("@repo/twitch-api", () => ({ TwitchApi: class {} }));

const { extractReceivingBroadcasterId } = await import("./eventHandler");

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
});
