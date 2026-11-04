import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { TwitchApi } from "@repo/twitch-api";

// syncTwitch only fans out over Helix when claimClipSync grants the sync
// (SW-480): a skipped sync makes no Twitch call and writes no status.

type Claim = { claimed: true } | { claimed: false; lastSync: string | null; status: "syncing" | "completed" | "failed" | null };

let claim: Claim;
let claimCalls: { userId: string; cooldownMs: number }[];
let statusUpdates: { status: string; count?: number; error?: string | null }[];
let helixCalls: number;
let helixFails: boolean;

mock.module("@repo/sentry", () => ({ reportError: () => {} }));
mock.module("@repo/supabase", () => ({ supabase: {} }));
// Spread the real exports: bun shares module mocks across test files.
const realUser = await import("@repo/supabase/queries/user");
mock.module("@repo/supabase/queries/user", () => ({
  ...realUser,
  getTwitchIntegrationByBroadcasterId: async (_c: unknown, broadcasterId: string) =>
    broadcasterId === "1001" ? { data: { user_id: "user-1" }, error: null } : { data: null, error: null },
  getTwitchIntegrationByUserId: async () => ({ data: { twitch_user_id: "1001" }, error: null }),
}));
const realSync = await import("@repo/supabase/queries/sync");
mock.module("@repo/supabase/queries/sync", () => ({
  ...realSync,
  claimClipSync: async (_c: unknown, userId: string, _now: Date, cooldownMs: number) => {
    claimCalls.push({ userId, cooldownMs });
    return claim;
  },
  updateClipSyncStatus: async (_c: unknown, _userId: string, status: string, count?: number, error?: string | null) => {
    statusUpdates.push({ status, count, error });
  },
}));
const realClips = await import("@repo/supabase/queries/clips");
mock.module("@repo/supabase/queries/clips", () => ({ ...realClips, upsertClips: async () => {} }));
const realVods = await import("@repo/supabase/queries/vods");
mock.module("@repo/supabase/queries/vods", () => ({ ...realVods, getVodsByVideoIds: async () => new Set<string>() }));

const { syncTwitch } = await import("./clip-sync");

const twitch = {
  clips: {
    getClips: async () => {
      helixCalls++;
      if (helixFails) throw new Error("helix down");
      return { data: [{ id: "c1", video_id: "" }, { id: "c2", video_id: "" }], pagination: {} };
    },
  },
} as unknown as TwitchApi;

beforeEach(() => {
  claim = { claimed: true };
  claimCalls = [];
  statusUpdates = [];
  helixCalls = 0;
  helixFails = false;
});

describe("syncTwitch", () => {
  test("asks for the claim with a one-hour cooldown for the channel's user", async () => {
    await syncTwitch("1001", twitch);
    expect(claimCalls).toEqual([{ userId: "user-1", cooldownMs: 60 * 60 * 1000 }]);
  });

  test("a granted claim syncs and marks the sync completed", async () => {
    expect(await syncTwitch("1001", twitch)).toEqual({ clipsCount: 2 });
    expect(helixCalls).toBe(1);
    expect(statusUpdates).toEqual([{ status: "completed", count: 2, error: undefined }]);
  });

  test("a sync inside the cooldown is skipped without touching Twitch", async () => {
    claim = { claimed: false, lastSync: "2026-11-04T11:50:00.000Z", status: "completed" };
    expect(await syncTwitch("1001", twitch)).toEqual({ skipped: true, running: false, lastSync: "2026-11-04T11:50:00.000Z" });
    expect(helixCalls).toBe(0);
    expect(statusUpdates).toEqual([]);
  });

  test("a sync that is already running is skipped and reported as running", async () => {
    claim = { claimed: false, lastSync: "2026-11-04T11:59:00.000Z", status: "syncing" };
    expect(await syncTwitch("1001", twitch)).toMatchObject({ skipped: true, running: true });
    expect(helixCalls).toBe(0);
  });

  test("a failed sync is marked failed and rethrown", async () => {
    helixFails = true;
    await expect(syncTwitch("1001", twitch)).rejects.toThrow("helix down");
    expect(statusUpdates).toEqual([{ status: "failed", count: undefined, error: "helix down" }]);
  });

  test("an unknown channel never gets a claim", async () => {
    await expect(syncTwitch("9999", twitch)).rejects.toThrow();
    expect(claimCalls).toEqual([]);
  });
});
