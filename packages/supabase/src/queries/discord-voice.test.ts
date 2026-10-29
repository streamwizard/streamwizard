import { describe, expect, test } from "bun:test";
import { staffRolesFor } from "./discord-voice";

describe("staffRolesFor", () => {
  test("a hub's own list wins, even when it's empty", () => {
    expect(staffRolesFor({ staff_role_ids: ["hub"] }, { staff_role_ids: ["server"] })).toEqual(["hub"]);
    expect(staffRolesFor({ staff_role_ids: [] }, { staff_role_ids: ["server"] })).toEqual([]);
  });

  test("falls back to the server's list, then to none", () => {
    expect(staffRolesFor({ staff_role_ids: null }, { staff_role_ids: ["server"] })).toEqual(["server"]);
    expect(staffRolesFor(null, { staff_role_ids: ["server"] })).toEqual(["server"]);
    expect(staffRolesFor(null, null)).toEqual([]);
  });
});
