import { describe, expect, test } from "bun:test";
import {
  BANNED_MAX,
  claimRefusal,
  cleanSummary,
  CREATE_GRACE_MS,
  ownerRefusal,
  reconcileAction,
  renameBlockRefusal,
  targetRefusal,
  type TargetCheck,
} from "./rules";

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
    for (const action of ["kick", "ban"] as const) {
      expect(targetRefusal(action, temp, check({ targetId: "bot", targetIsBot: true }))).toContain("I'm staying");
    }
    expect(targetRefusal("transfer", temp, check({ targetId: "bot", targetIsBot: true }))).toContain("Pick a human");
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

  test("voice staff can't be kicked or banned, but can be unbanned", () => {
    expect(targetRefusal("kick", temp, check({ targetIsStaff: true }))).toContain("is staff here");
    expect(targetRefusal("ban", temp, check({ targetIsStaff: true }))).toContain("is staff here");
    expect(targetRefusal("unban", temp, check({ targetId: "banned", targetIsStaff: true }))).toBeNull();
  });

  test("invite needs a member of the server who isn't banned or already in", () => {
    const notIn = { targetInChannel: false };
    expect(targetRefusal("invite", temp, check(notIn))).toBeNull();
    expect(targetRefusal("invite", temp, check({ ...notIn, targetId: "owner" }))).toContain("It's your channel");
    expect(targetRefusal("invite", temp, check({ ...notIn, targetId: "banned" }))).toContain("/voice-unban");
    expect(targetRefusal("invite", temp, check({ ...notIn, targetId: "bot", targetIsBot: true }))).toContain("always here");
    expect(targetRefusal("invite", temp, check({ ...notIn, targetId: "otherbot", targetIsBot: true }))).toContain("Invite a human");
    expect(targetRefusal("invite", temp, check({ ...notIn, targetIsMember: false }))).toContain("without a member");
    expect(targetRefusal("invite", temp, check())).toContain("already in here");
  });

  test("staff transferring someone else's channel", () => {
    const staff = { actorId: "staff", targetIsStaff: false };
    expect(targetRefusal("transfer", temp, check(staff))).toBeNull();
    expect(targetRefusal("transfer", temp, check({ ...staff, targetId: "owner" }))).toContain("already owns this channel");
    expect(targetRefusal("transfer", temp, check({ ...staff, targetId: "staff" }))).toContain("/voice-claim");
  });

  test("transfer needs a person in the channel who owns nothing else", () => {
    expect(targetRefusal("transfer", temp, check())).toBeNull();
    expect(targetRefusal("transfer", temp, check({ targetIsBot: true, targetId: "otherbot" }))).toContain("<@otherbot> is a bot");
    expect(targetRefusal("transfer", temp, check({ targetInChannel: false }))).toContain("needs to be in the channel");
    expect(targetRefusal("transfer", temp, check({ targetOwnsOther: "c2" }))).toContain("<#c2>");
  });
});

describe("targetRefusal for voice staff acting for the owner", () => {
  const staff = (overrides: Partial<TargetCheck> = {}) => check({ actorId: "staff", ...overrides });

  test("can't ban the owner, but can kick them", () => {
    expect(targetRefusal("ban", temp, staff({ targetId: "owner" }))).toContain("/voice-transfer");
    expect(targetRefusal("kick", temp, staff({ targetId: "owner" }))).toBeNull();
  });

  test("inviting or unbanning the owner says they always get in", () => {
    expect(targetRefusal("invite", temp, staff({ targetId: "owner", targetInChannel: false }))).toContain("can always get in");
    expect(targetRefusal("unban", temp, staff({ targetId: "owner" }))).toContain("not banned");
  });

  test("pointing at themselves gets staff wording, not owner wording", () => {
    expect(targetRefusal("invite", temp, staff({ targetId: "staff" }))).toBe("You're staff here, so you get in anyway.");
    expect(targetRefusal("ban", temp, staff({ targetId: "staff" }))).toBe("You can't ban yourself.");
  });

  test("everyone else works the same as for the owner", () => {
    expect(targetRefusal("ban", temp, staff())).toBeNull();
    expect(targetRefusal("invite", temp, staff({ targetInChannel: false }))).toBeNull();
  });
});

describe("renameBlockRefusal", () => {
  const block = { actorId: "staff", targetId: "member", targetIsBot: false, targetIsStaff: false, alreadyBlocked: false };

  test("a regular member can be blocked", () => {
    expect(renameBlockRefusal(block)).toBeNull();
  });

  test("not yourself, a bot, staff, or someone already blocked", () => {
    expect(renameBlockRefusal({ ...block, targetId: "staff" })).toBe("You can't block yourself.");
    expect(renameBlockRefusal({ ...block, targetIsBot: true })).toContain("is a bot");
    expect(renameBlockRefusal({ ...block, targetIsStaff: true })).toContain("is voice staff");
    expect(renameBlockRefusal({ ...block, alreadyBlocked: true })).toContain("already blocked");
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

  test("voice staff take over with the owner still there, but still need to be in and own nothing else", () => {
    const staff = { ...claim, ownerPresent: true, claimerIsStaff: true };
    expect(claimRefusal(staff)).toBeNull();
    expect(claimRefusal({ ...staff, claimerInChannel: false })).toContain("Join the channel first");
    expect(claimRefusal({ ...staff, claimerOwnsOther: "c2" })).toContain("<#c2>");
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
