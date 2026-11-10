import { beforeEach, describe, expect, mock, test } from "bun:test";
import { z } from "zod";

let reported: { context: string; extra?: Record<string, unknown> }[] = [];
let logTwitchEvent: () => Promise<void> = async () => {};
let broadcastOverlayEvent: () => Promise<void> = async () => {};

// The registry wires real handlers and clients at import; each test
// registers its own handlers.
mock.module("./twitch", () => ({ registerTwitchHandlers: () => {} }));
mock.module("@repo/sentry", () => ({
  reportError: (_error: unknown, context: string, extra?: Record<string, unknown>) => {
    reported.push({ context, extra });
  },
}));
mock.module("@repo/logger", () => ({ streamEventsLogger: { logTwitchEvent: () => logTwitchEvent() } }));
mock.module("@repo/metrics", () => ({ trackEventSubReceived: () => {} }));
mock.module("../functions/broadcastOverlayEvent", () => ({ broadcastOverlayEvent: () => broadcastOverlayEvent() }));
mock.module("../functions/recordStreamLabels", () => ({ recordStreamLabels: async () => {} }));
mock.module("@repo/twitch-api", () => ({ TwitchApi: class {} }));

const { HandlerRegistry } = await import("./eventHandler");

function notification(type: string, event: Record<string, unknown>) {
  return {
    metadata: { message_id: "m1", message_type: "notification", message_timestamp: "" },
    payload: { subscription: { type, condition: { broadcaster_user_id: "b1" } }, event },
  } as never;
}

describe("HandlerRegistry error reporting", () => {
  beforeEach(() => {
    reported = [];
    logTwitchEvent = async () => {};
    broadcastOverlayEvent = async () => {};
  });

  test("a throwing handler is reported once, not on every event", async () => {
    const registry = new HandlerRegistry();
    registry.registerTwitchHandler("channel.update", async () => {
      throw new Error("handler broke");
    });

    await registry.processTwitchEvent("channel.update", notification("channel.update", { broadcaster_user_id: "b1" }));
    await registry.processTwitchEvent("channel.update", notification("channel.update", { broadcaster_user_id: "b1" }));

    expect(reported).toEqual([{ context: "eventsub: handler", extra: { type: "channel.update", broadcasterId: "b1" } }]);
  });

  test("a payload that fails its schema skips the handler and is reported once per type", async () => {
    const registry = new HandlerRegistry();
    const handler = mock(async () => {});
    registry.registerTwitchHandler("channel.cheer", handler, z.object({ bits: z.number() }));

    await registry.processTwitchEvent("channel.cheer", notification("channel.cheer", { bits: "lots" }));
    await registry.processTwitchEvent("channel.cheer", notification("channel.cheer", { bits: "lots" }));

    expect(handler).not.toHaveBeenCalled();
    expect(reported).toEqual([{ context: "eventsub: schema mismatch", extra: { type: "channel.cheer", broadcasterId: "b1" } }]);
  });

  test("a failed event-log insert is reported once while it keeps failing", async () => {
    logTwitchEvent = async () => {
      throw new Error("insert failed");
    };
    const registry = new HandlerRegistry();

    await registry.processTwitchEvent("channel.follow", notification("channel.follow", { broadcaster_user_id: "b1" }));
    await registry.processTwitchEvent("channel.follow", notification("channel.follow", { broadcaster_user_id: "b1" }));
    await Bun.sleep(0);

    expect(reported).toEqual([{ context: "eventsub: log event", extra: { type: "channel.follow", broadcasterId: "b1" } }]);
  });

  test("a failed overlay broadcast is reported and the bot handler still runs", async () => {
    broadcastOverlayEvent = async () => {
      throw new Error("ws-server down");
    };
    const registry = new HandlerRegistry();
    const handler = mock(async () => {});
    registry.registerTwitchHandler("channel.subscribe", handler);

    await registry.processTwitchEvent("channel.subscribe", notification("channel.subscribe", { broadcaster_user_id: "b1" }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(reported).toEqual([{ context: "eventsub: overlay broadcast", extra: { type: "channel.subscribe", broadcasterId: "b1" } }]);
  });
});
