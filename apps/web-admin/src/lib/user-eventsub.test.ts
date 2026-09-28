import { describe, expect, test } from "bun:test";
import type { EventSubSubscription } from "@repo/twitch-api";
import { buildNeededEventSubscriptions } from "@repo/types";
import { diffUserSubscriptions } from "./user-eventsub";

const CONDUIT = "conduit-1";
const CALLBACK = "https://api.example.com/webhooks/twitch/eventsub";

const needed = [
  {
    type: "channel.follow" as const,
    version: "2",
    condition: {},
    transport: { method: "conduit" as const, conduit_id: CONDUIT },
  },
  {
    type: "stream.online" as const,
    version: "1",
    condition: {},
    transport: { method: "webhook" as const, callback: CALLBACK },
  },
];

let nextId = 0;
const sub = (
  type: string,
  version: string,
  status: EventSubSubscription["status"],
  transport: EventSubSubscription["transport"],
): EventSubSubscription => ({
  id: `sub-${++nextId}`,
  type,
  version,
  status,
  transport,
  condition: {},
  created_at: "2026-09-28T12:00:00Z",
  cost: 0,
});

describe("diffUserSubscriptions", () => {
  test("everything live is ok", () => {
    const diff = diffUserSubscriptions(
      [
        sub("channel.follow", "2", "enabled", { method: "conduit", conduit_id: CONDUIT }),
        sub("stream.online", "1", "webhook_callback_verification_pending", { method: "webhook", callback: CALLBACK }),
      ],
      needed,
    );
    expect(diff.counts).toEqual({ ok: 2, missing: 0, failed: 0, extra: 0 });
    expect(diff.missing).toEqual([]);
  });

  test("a dead subscription is failed and its type still missing", () => {
    const dead = sub("channel.follow", "2", "authorization_revoked", { method: "conduit", conduit_id: CONDUIT });
    const diff = diffUserSubscriptions([dead], needed);
    expect(diff.counts).toEqual({ ok: 0, missing: 2, failed: 1, extra: 0 });
    expect(diff.failedIds).toEqual([dead.id]);
    expect(diff.missing.map((m) => m.type)).toEqual(["channel.follow", "stream.online"]);
    expect(diff.rows[0]?.state).toBe("missing");
  });

  test("wrong conduit, version or callback is extra, not ok", () => {
    const diff = diffUserSubscriptions(
      [
        sub("channel.follow", "2", "enabled", { method: "conduit", conduit_id: "old-conduit" }),
        sub("channel.follow", "1", "enabled", { method: "conduit", conduit_id: CONDUIT }),
        sub("stream.online", "1", "enabled", { method: "webhook", callback: "https://old.example.com/hook" }),
      ],
      needed,
    );
    expect(diff.counts).toEqual({ ok: 0, missing: 2, failed: 0, extra: 3 });
    expect(diff.failedIds).toEqual([]);
  });

  test("a duplicate live subscription shows as extra", () => {
    const diff = diffUserSubscriptions(
      [
        sub("channel.follow", "2", "enabled", { method: "conduit", conduit_id: CONDUIT }),
        sub("channel.follow", "2", "enabled", { method: "conduit", conduit_id: CONDUIT }),
      ],
      needed.slice(0, 1),
    );
    expect(diff.counts).toEqual({ ok: 1, missing: 0, failed: 0, extra: 1 });
  });
});

describe("buildNeededEventSubscriptions", () => {
  test("skips scoped types the token lacks and webhooks when null", () => {
    const without = buildNeededEventSubscriptions({ twitchUserId: "1", grantedScopes: [], conduitId: CONDUIT, webhook: null });
    const withPolls = buildNeededEventSubscriptions({
      twitchUserId: "1",
      grantedScopes: ["channel:read:polls"],
      conduitId: CONDUIT,
      webhook: { callback: CALLBACK },
    });
    expect(without.some((s) => s.type === "channel.poll.begin")).toBe(false);
    expect(without.every((s) => s.transport.method === "conduit")).toBe(true);
    expect(withPolls.some((s) => s.type === "channel.poll.begin")).toBe(true);
    expect(withPolls.filter((s) => s.transport.method === "webhook").map((s) => s.type)).toEqual([
      "stream.offline",
      "stream.online",
      "channel.update",
    ]);
  });
});
