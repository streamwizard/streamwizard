import { describe, expect, test } from "bun:test";
import { buildSubscriptionInventory, CONDUIT_TYPES, toLifecycleRow, WEBHOOK_TYPES } from "./eventsub-inventory";

const sub = (type: string, status: string, method: string) =>
  ({ type, status, transport: { method } }) as Parameters<typeof buildSubscriptionInventory>[0][number];

describe("buildSubscriptionInventory", () => {
  const totals = { total: 158, totalCost: 2, maxTotalCost: 10000 };

  test("counts per type and status, busiest type first", () => {
    const inv = buildSubscriptionInventory(
      [
        sub("channel.chat.message", "enabled", "conduit"),
        sub("channel.chat.message", "enabled", "conduit"),
        sub("channel.chat.message", "authorization_revoked", "conduit"),
        sub("stream.online", "enabled", "webhook"),
      ],
      totals,
      false,
      "2026-09-28T12:00:00Z",
    );
    expect(inv.total).toBe(158);
    expect(inv.byStatus).toEqual({ enabled: 3, authorization_revoked: 1 });
    expect(inv.types[0]).toEqual({
      type: "channel.chat.message",
      transport: "conduit",
      total: 3,
      byStatus: { enabled: 2, authorization_revoked: 1 },
      expected: true,
    });
    expect(inv.types[1]?.type).toBe("stream.online");
  });

  test("keeps a type subscribed on two transports as two rows", () => {
    const inv = buildSubscriptionInventory(
      [sub("channel.update", "enabled", "conduit"), sub("channel.update", "enabled", "webhook")],
      totals,
      false,
      "t",
    );
    expect(inv.types.map((t) => t.transport).sort()).toEqual(["conduit", "webhook"]);
  });

  test("flags types StreamWizard doesn't subscribe to, and a capped scan", () => {
    const inv = buildSubscriptionInventory([sub("channel.ban", "enabled", "websocket")], totals, true, "t");
    expect(inv.types[0]?.expected).toBe(false);
    expect(inv.partial).toBe(true);
  });
});

describe("shared subscription lists", () => {
  test("webhook and conduit types are deduplicated", () => {
    expect(WEBHOOK_TYPES).toContain("stream.online");
    expect(CONDUIT_TYPES).toContain("channel.chat.message");
    expect(new Set(CONDUIT_TYPES).size).toBe(CONDUIT_TYPES.length);
  });
});

describe("toLifecycleRow", () => {
  test("flattens the payload", () => {
    const row = toLifecycleRow({
      id: 7,
      event_type: "eventsub.reconnected",
      created_at: "2026-09-28T12:00:00Z",
      payload: { service: "streamwizard-bot", shard_id: "3", session_id: "s1", downtime_ms: 4200, attempts: 2 },
    });
    expect(row).toMatchObject({ id: 7, shardId: "3", sessionId: "s1", downtimeMs: 4200, service: "streamwizard-bot" });
  });

  test("rows from before shards count as shard 0, and junk payloads don't throw", () => {
    expect(toLifecycleRow({ id: 1, event_type: "eventsub.connection_lost", created_at: "t", payload: { reason: "x" } }).shardId).toBe("0");
    expect(toLifecycleRow({ id: 2, event_type: "eventsub.connected", created_at: "t", payload: null }).service).toBeNull();
  });
});
