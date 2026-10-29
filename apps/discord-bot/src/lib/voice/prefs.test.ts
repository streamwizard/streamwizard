import { describe, expect, test } from "bun:test";
import { startingState } from "./prefs";

const hub = { default_user_limit: 5 };
const opts = { templateName: "pogfrog's channel", ownerId: "owner" };
const saved = { name: "Late night chill", user_limit: 3, locked: true, hidden: false, banned_user_ids: ["troll"] };

describe("startingState", () => {
  test("nothing saved: the hub's defaults, open and visible", () => {
    expect(startingState(hub, null, opts)).toEqual({
      name: "pogfrog's channel",
      userLimit: 5,
      locked: false,
      hidden: false,
      bannedUserIds: [],
    });
  });

  test("saved settings win over the hub's", () => {
    expect(startingState(hub, saved, opts)).toEqual({
      name: "Late night chill",
      userLimit: 3,
      locked: true,
      hidden: false,
      bannedUserIds: ["troll"],
    });
  });

  test("a saved limit of 0 means no limit, not the hub's default", () => {
    expect(startingState(hub, { ...saved, user_limit: 0 }, opts).userLimit).toBe(0);
  });

  test("unsaved name and limit fall back to the hub's", () => {
    const state = startingState(hub, { ...saved, name: null, user_limit: null }, opts);
    expect(state.name).toBe("pogfrog's channel");
    expect(state.userLimit).toBe(5);
  });

  test("a blank saved name falls back to the template", () => {
    expect(startingState(hub, { ...saved, name: "   " }, opts).name).toBe("pogfrog's channel");
  });

  test("the owner is never banned from their own channel", () => {
    expect(startingState(hub, { ...saved, banned_user_ids: ["troll", "owner"] }, opts).bannedUserIds).toEqual(["troll"]);
  });
});
