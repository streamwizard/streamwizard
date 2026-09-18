import { describe, expect, test } from "bun:test";
import { isLogRouteActive, resolveLogRoute, type LogRouting } from "@repo/supabase/queries/platform-events";

const routing = (overrides: Partial<LogRouting> = {}): LogRouting => ({
  guildId: "1",
  defaultChannelId: null,
  ignoredChannelIds: [],
  events: {},
  ...overrides,
});

describe("log routing", () => {
  test("no settings row: nothing is active", () => {
    expect(isLogRouteActive(null, "message.edited")).toBe(false);
  });

  test("settings without a channel: enabled but not active, so nothing is stored", () => {
    const r = routing();
    expect(resolveLogRoute(r, "message.edited").enabled).toBe(true);
    expect(isLogRouteActive(r, "message.edited")).toBe(false);
  });

  test("default channel makes default-on types active, off-by-default types stay off", () => {
    const r = routing({ defaultChannelId: "223456789012345678" });
    expect(isLogRouteActive(r, "message.edited")).toBe(true);
    expect(isLogRouteActive(r, "voice.joined")).toBe(false);
  });

  test("a per-type channel is enough on its own, and a per-type off wins over the default channel", () => {
    const r = routing({
      defaultChannelId: "223456789012345678",
      events: {
        "voice.joined": { enabled: true, channelId: "323456789012345678" },
        "message.edited": { enabled: false, channelId: null },
      },
    });
    expect(isLogRouteActive(r, "voice.joined")).toBe(true);
    expect(isLogRouteActive(r, "message.edited")).toBe(false);
    expect(
      isLogRouteActive(
        routing({ events: { "ticket.opened": { enabled: true, channelId: "323456789012345678" } } }),
        "ticket.opened",
      ),
    ).toBe(true);
  });

  test("the test event is always on but still needs a channel", () => {
    expect(isLogRouteActive(routing({ events: { "log.test": { enabled: false, channelId: null } } }), "log.test")).toBe(
      false,
    );
    expect(
      isLogRouteActive(
        routing({
          defaultChannelId: "223456789012345678",
          events: { "log.test": { enabled: false, channelId: null } },
        }),
        "log.test",
      ),
    ).toBe(true);
  });
});
