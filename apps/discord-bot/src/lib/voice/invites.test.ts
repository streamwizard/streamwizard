import { describe, expect, test } from "bun:test";
import {
  addPendingInvite,
  countChannelInvites,
  forgetChannelInvites,
  forgetInvites,
  pendingInvites,
  usedInviteCodes,
  type PendingInvite,
} from "./invites";

const invite = (code: string, overrides: Partial<PendingInvite> = {}): PendingInvite => ({
  code,
  guildId: "g1",
  channelId: "c1",
  expiresAt: 10_000,
  ...overrides,
});

describe("usedInviteCodes", () => {
  test("a pending link missing from the live invites was used", () => {
    expect(usedInviteCodes([invite("a"), invite("b")], new Set(["b"]), 5_000)).toEqual(["a"]);
  });

  test("nothing is used while every link is still live", () => {
    expect(usedInviteCodes([invite("a")], new Set(["a"]), 5_000)).toEqual([]);
  });

  test("an expired link isn't counted, gone or not", () => {
    expect(usedInviteCodes([invite("a", { expiresAt: 1_000 })], new Set(), 5_000)).toEqual([]);
  });

  test("returns every missing link, so the caller can tell a clash", () => {
    expect(usedInviteCodes([invite("a"), invite("b")], new Set(), 5_000)).toEqual(["a", "b"]);
  });
});

describe("pending invite store", () => {
  test("keeps links per guild and channel, drops expired and forgotten ones", () => {
    addPendingInvite(invite("s1", { expiresAt: 20_000 }));
    addPendingInvite(invite("s2", { channelId: "c2", expiresAt: 20_000 }));
    addPendingInvite(invite("s3", { guildId: "g2", channelId: "c3", expiresAt: 20_000 }));
    addPendingInvite(invite("s4", { expiresAt: 2_000 }));

    expect(pendingInvites("g1", 5_000).map((i) => i.code).sort()).toEqual(["s1", "s2"]);
    expect(countChannelInvites("c1", 5_000)).toBe(1);

    forgetInvites(["s1"]);
    expect(countChannelInvites("c1", 5_000)).toBe(0);

    forgetChannelInvites("c2");
    expect(pendingInvites("g1", 5_000)).toEqual([]);
    forgetChannelInvites("c1");
    forgetInvites(["s3"]);
  });
});
