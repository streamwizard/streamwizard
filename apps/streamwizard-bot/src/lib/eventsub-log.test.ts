import { beforeEach, describe, expect, mock, test } from "bun:test";

const emitted: { type: string; payload: Record<string, unknown> }[] = [];
mock.module("@repo/supabase", () => ({ supabase: {} }));
mock.module("@repo/supabase/queries/platform-events", () => ({
  logPlatformEvent: async (_client: unknown, event: { type: string; payload: Record<string, unknown> }) => {
    emitted.push({ type: event.type, payload: event.payload });
  },
}));

const { createEventSubLogger } = await import("./eventsub-log");

const types = () => emitted.map((e) => e.type);

describe("eventsub log", () => {
  beforeEach(() => {
    emitted.length = 0;
  });

  test("first session after boot is eventsub.connected, once", () => {
    const log = createEventSubLogger();
    log({ type: "connected", sessionId: "s1", attempt: 0, downtimeMs: null });
    log({ type: "connected", sessionId: "s1", attempt: 0, downtimeMs: null });
    expect(types()).toEqual(["eventsub.connected"]);
    expect(emitted[0]?.payload).toEqual({ service: "streamwizard-bot", session_id: "s1" });
  });

  test("an outage is a lost row then a reconnected row with downtime and attempts", () => {
    const log = createEventSubLogger();
    log({ type: "connected", sessionId: "s1", attempt: 0, downtimeMs: null });
    log({ type: "keepalive_timeout", silentForMs: 15_000 });
    log({ type: "connection_lost", code: null, reason: "keepalive timeout" });
    log({ type: "reconnect_scheduled", attempt: 1, delayMs: 1000 });
    log({ type: "reconnect_scheduled", attempt: 2, delayMs: 2000 });
    log({ type: "connected", sessionId: "s2", attempt: 2, downtimeMs: 4200 });
    expect(types()).toEqual(["eventsub.connected", "eventsub.connection_lost", "eventsub.reconnected"]);
    expect(emitted[1]?.payload).toEqual({
      service: "streamwizard-bot",
      reason: "keepalive timeout",
      close_code: null,
      keepalive_silent_ms: 15_000,
    });
    expect(emitted[2]?.payload).toEqual({ service: "streamwizard-bot", session_id: "s2", downtime_ms: 4200, attempts: 2 });
  });

  test("a close code is kept and keepalive silence only applies to the loss that followed it", () => {
    const log = createEventSubLogger();
    log({ type: "connected", sessionId: "s1", attempt: 0, downtimeMs: null });
    log({ type: "connection_lost", code: 4003, reason: "connection unused" });
    expect(emitted[1]?.payload).toEqual({
      service: "streamwizard-bot",
      reason: "connection unused",
      close_code: 4003,
      keepalive_silent_ms: null,
    });
  });

  test("a Twitch session move is eventsub.session_migrated, not connected or reconnected", () => {
    const log = createEventSubLogger();
    log({ type: "connected", sessionId: "s1", attempt: 0, downtimeMs: null });
    log({ type: "session_reconnect_requested" });
    log({ type: "connected", sessionId: "s2", attempt: 0, downtimeMs: null });
    expect(types()).toEqual(["eventsub.connected", "eventsub.session_migrated"]);
    expect(emitted[1]?.payload).toEqual({ service: "streamwizard-bot", session_id: "s2" });
  });

  test("a failed session move falls into a normal outage", () => {
    const log = createEventSubLogger();
    log({ type: "connected", sessionId: "s1", attempt: 0, downtimeMs: null });
    log({ type: "session_reconnect_requested" });
    log({ type: "connection_lost", code: null, reason: "pending welcome timeout" });
    log({ type: "connected", sessionId: "s3", attempt: 1, downtimeMs: 16_000 });
    expect(types()).toEqual(["eventsub.connected", "eventsub.connection_lost", "eventsub.reconnected"]);
  });

  test("revocations and conduit failures are logged with the error as text", () => {
    const log = createEventSubLogger();
    log({ type: "subscription_revoked", subscriptionType: "channel.follow", status: "authorization_revoked", reason: "The user revoked access" });
    log({ type: "conduit_update_failed", error: new Error("429 Too Many Requests") });
    expect(types()).toEqual(["eventsub.subscription_revoked", "eventsub.conduit_update_failed"]);
    expect(emitted[0]?.payload).toEqual({
      service: "streamwizard-bot",
      subscription_type: "channel.follow",
      status: "authorization_revoked",
      reason: "The user revoked access",
    });
    expect(emitted[1]?.payload).toEqual({ service: "streamwizard-bot", error: "429 Too Many Requests" });
  });
});
