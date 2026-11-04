import { beforeEach, describe, expect, mock, test } from "bun:test";
import { z } from "zod";

let reported: { context: string; extra?: Record<string, unknown> }[];
let lookup: { data: unknown; error: unknown };

mock.module("@repo/sentry", () => ({
  reportError: (_error: unknown, context: string, extra?: Record<string, unknown>) => {
    reported.push({ context, extra });
  },
}));
mock.module("@repo/supabase", () => ({ supabase: {} }));
// Same export set as viewer-count-poller.test.ts: bun's mock.module is
// process-wide, so the files must agree on the module's shape.
mock.module("@repo/supabase/queries/user", () => ({
  getTwitchIntegrationByBroadcasterId: async () => lookup,
  getUserPreferencesByUserId: async () => null,
}));
mock.module("@repo/twitch-api", () => ({ TwitchApi: class {} }));
// The real handlers pull in the whole app; each test registers its own.
mock.module("./register", () => ({ registerTwitchHandlers: () => {} }));

const { HandlerRegistry } = await import("./registry");

const condition = { broadcaster_user_id: "b1" };
const event = { broadcaster_user_id: "b1" } as never;

beforeEach(() => {
  reported = [];
  lookup = { data: { user_id: "u1" }, error: null };
});

describe("HandlerRegistry", () => {
  test("a throwing handler is reported once, not on every event", async () => {
    const registry = new HandlerRegistry();
    registry.registerTwitchHandler("channel.update", async () => {
      throw new Error("handler broke");
    });

    await registry.processTwitchEvent("channel.update", event, condition);
    await registry.processTwitchEvent("channel.update", event, condition);

    expect(reported).toEqual([{ context: "eventsub: handler", extra: { type: "channel.update", broadcasterId: "b1" } }]);
  });

  test("a different error from the same handler gets its own report", async () => {
    const registry = new HandlerRegistry();
    let message = "first failure";
    registry.registerTwitchHandler("stream.offline", async () => {
      throw new Error(message);
    });

    await registry.processTwitchEvent("stream.offline", event, condition);
    message = "second failure";
    await registry.processTwitchEvent("stream.offline", event, condition);

    expect(reported.map((r) => r.context)).toEqual(["eventsub: handler", "eventsub: handler"]);
  });

  test("a payload that fails its schema skips the handler and is reported once per type", async () => {
    const registry = new HandlerRegistry();
    const handler = mock(async () => {});
    registry.registerTwitchHandler("stream.online", handler, z.object({ id: z.string() }));

    await registry.processTwitchEvent("stream.online", event, condition);
    await registry.processTwitchEvent("stream.online", event, condition);

    expect(handler).not.toHaveBeenCalled();
    expect(reported).toEqual([{ context: "eventsub: schema mismatch", extra: { type: "stream.online", broadcasterId: "b1" } }]);
  });

  test("a valid payload reaches the handler with nothing reported", async () => {
    const registry = new HandlerRegistry();
    const handler = mock(async () => {});
    registry.registerTwitchHandler("user.authorization.revoke", handler, z.object({ broadcaster_user_id: z.string() }));

    await registry.processTwitchEvent("user.authorization.revoke", event, condition);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(reported).toEqual([]);
  });

  test("an unknown broadcaster is skipped without a report; a failed lookup is reported", async () => {
    const registry = new HandlerRegistry();
    const handler = mock(async () => {});
    registry.registerTwitchHandler("channel.follow", handler);

    lookup = { data: null, error: { code: "PGRST116", message: "no rows" } };
    await registry.processTwitchEvent("channel.follow", event, condition);
    expect(reported).toEqual([]);

    lookup = { data: null, error: { code: "57014", message: "statement timeout" } };
    await registry.processTwitchEvent("channel.follow", event, condition);
    expect(reported.map((r) => r.context)).toEqual(["eventsub: broadcaster lookup"]);
    expect(handler).not.toHaveBeenCalled();
  });
});
