import { describe, expect, test } from "bun:test";
import { whyCannotHandOut, type RoleGrantCheck } from "./role-grant-check";

const GUILD = "100000000000000000";
const check = (patch: Partial<RoleGrantCheck> = {}): RoleGrantCheck => ({
  role: { id: "200000000000000001", position: 5, managed: false },
  guildId: GUILD,
  botHighestPosition: 20,
  isOwner: false,
  hasManageRoles: true,
  actorHighestPosition: 10,
  ...patch,
});

describe("whyCannotHandOut", () => {
  test("a Manage Roles member may pick a role below their own and the bot's", () => {
    expect(whyCannotHandOut(check())).toBeNull();
  });

  test("Manage Server alone is not enough: the bot would grant what the member can't", () => {
    expect(whyCannotHandOut(check({ hasManageRoles: false }))).toContain("Manage Roles");
  });

  test("a role at or above the member's highest role is refused", () => {
    expect(whyCannotHandOut(check({ role: { id: "2", position: 10, managed: false } }))).toContain("below your own");
    expect(whyCannotHandOut(check({ role: { id: "2", position: 15, managed: false } }))).toContain("below your own");
  });

  test("the owner may pick any role the bot can grant", () => {
    expect(whyCannotHandOut(check({ isOwner: true, hasManageRoles: false, role: { id: "2", position: 15, managed: false } }))).toBeNull();
  });

  test("never @everyone, managed roles, or roles at or above the bot", () => {
    expect(whyCannotHandOut(check({ isOwner: true, role: { id: GUILD, position: 0, managed: false } }))).toContain("@everyone");
    expect(whyCannotHandOut(check({ isOwner: true, role: { id: "2", position: 3, managed: true } }))).toContain("integration");
    expect(whyCannotHandOut(check({ isOwner: true, role: { id: "2", position: 20, managed: false } }))).toContain("above");
    expect(whyCannotHandOut(check({ isOwner: true, botHighestPosition: null }))).toContain("above");
    expect(whyCannotHandOut(check({ role: null }))).not.toBeNull();
  });
});
