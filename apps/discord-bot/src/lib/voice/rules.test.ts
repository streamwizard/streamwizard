import { describe, expect, test } from "bun:test";
import { BANNED_MAX, claimRefusal, cleanSummary, CREATE_GRACE_MS, ownerRefusal, reconcileAction, targetRefusal, type TargetCheck } from "./rules";

const temp = { ownerId: "owner", bannedUserIds: ["banned"] };
const check = (overrides: Partial<TargetCheck> = {}): TargetCheck => ({
  actorId: "owner",
  botId: "bot",
  targetId: "guest",
  targetIsBot: false,
  targetIsMember: true,
  targetInChannel: true,
  targetOwnsOther: null,
  ...overrides,
});

describe("ownerRefusal", () => {
  test("the owner passes", () => {
    expect(ownerRefusal("owner", temp, true)).toBeNull();
  });

  test("anyone else is told who owns it", () => {
    expect(ownerRefusal("guest", temp, true)).toContain("<@owner>");
  });

  test("points at /voice-claim when the owner left", () => {
    expect(ownerRefusal("guest", temp, false)).toContain("/voice-claim");
    expect(ownerRefusal("guest", temp, true)).not.toContain("/voice-claim");
  });
});

describe("targetRefusal", () => {
  test("nobody targets themselves", () => {
    for (const action of ["kick", "ban", "unban", "transfer"] as const) {
      expect(targetRefusal(action, temp, check({ targetId: "owner" }))).not.toBeNull();
    }
  });

  test("the bot can't be kicked, banned or given the channel", () => {
    for (const action of ["kick", "ban", "transfer"] as const) {
      expect(targetRefusal(action, temp, check({ targetId: "bot", targetIsBot: true }))).toContain("I'm staying");
    }
  });

  test("kick needs the member in the channel", () => {
    expect(targetRefusal("kick", temp, check())).toBeNull();
    expect(targetRefusal("kick", temp, check({ targetInChannel: false }))).toContain("isn't in this channel");
  });

  test("ban works on members outside the channel, not on people outside the server", () => {
    expect(targetRefusal("ban", temp, check({ targetInChannel: false }))).toBeNull();
    expect(targetRefusal("ban", temp, check({ targetIsMember: false, targetInChannel: false }))).toContain("isn't in this server");
  });

  test("ban refuses someone already banned, and a full list", () => {
    expect(targetRefusal("ban", temp, check({ targetId: "banned" }))).toContain("already banned");
    const full = { ownerId: "owner", bannedUserIds: Array.from({ length: BANNED_MAX }, (_, i) => `u${i}`) };
    expect(targetRefusal("ban", full, check())).toContain("Unban someone first");
  });

  test("unban only takes someone on the list, even if they left the server", () => {
    expect(targetRefusal("unban", temp, check({ targetId: "banned", targetIsMember: false }))).toBeNull();
    expect(targetRefusal("unban", temp, check())).toContain("isn't banned");
  });

  test("transfer needs a person in the channel who owns nothing else", () => {
    expect(targetRefusal("transfer", temp, check())).toBeNull();
    expect(targetRefusal("transfer", temp, check({ targetIsBot: true, targetId: "otherbot" }))).toContain("Bots can't");
    expect(targetRefusal("transfer", temp, check({ targetInChannel: false }))).toContain("needs to be in the channel");
    expect(targetRefusal("transfer", temp, check({ targetOwnsOther: "c2" }))).toContain("<#c2>");
  });
});

describe("claimRefusal", () => {
  const claim = { claimerId: "guest", ownerId: "owner", claimerInChannel: true, ownerPresent: false, claimerOwnsOther: null };

  test("goes through when the owner left and the claimer is in the channel", () => {
    expect(claimRefusal(claim)).toBeNull();
  });

  test("only works while the owner is gone", () => {
    expect(claimRefusal({ ...claim, ownerPresent: true })).toContain("still here");
  });

  test("the claimer has to be in the channel", () => {
    expect(claimRefusal({ ...claim, claimerInChannel: false })).toContain("Join the channel first");
  });

  test("the owner can't claim their own channel", () => {
    expect(claimRefusal({ ...claim, claimerId: "owner" })).toBe("It's already yours.");
  });

  test("one channel per owner", () => {
    expect(claimRefusal({ ...claim, claimerOwnsOther: "c2" })).toContain("<#c2>");
  });
});

describe("reconcileAction", () => {
  const old = CREATE_GRACE_MS + 1;

  test("forgets a channel Discord no longer has", () => {
    expect(reconcileAction({ exists: false, humans: 0, ageMs: old })).toBe("forget");
  });

  test("deletes an empty channel", () => {
    expect(reconcileAction({ exists: true, humans: 0, ageMs: old })).toBe("delete");
  });

  test("keeps a channel with people in it", () => {
    expect(reconcileAction({ exists: true, humans: 2, ageMs: old })).toBe("keep");
  });

  test("keeps a just-created channel whose owner is still being moved in", () => {
    expect(reconcileAction({ exists: true, humans: 0, ageMs: 1_000 })).toBe("keep");
  });
});

describe("cleanSummary", () => {
  test("nothing to do", () => {
    expect(cleanSummary({ deleted: 0, forgotten: 0 })).toContain("Nothing to clean");
  });

  test("counts both, with plurals", () => {
    expect(cleanSummary({ deleted: 1, forgotten: 0 })).toBe("Cleaned up: deleted 1 empty channel.");
    expect(cleanSummary({ deleted: 2, forgotten: 1 })).toBe(
      "Cleaned up: deleted 2 empty channels and forgot 1 channel that was already gone.",
    );
  });
});
