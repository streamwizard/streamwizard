import { describe, expect, test } from "bun:test";
import { OverwriteType, PermissionFlagsBits } from "discord.js";
import {
  computeTicketOverwrites,
  isStaffMember,
  renderChannelName,
  staffRoleIds,
  whyCannotOpen,
  type OpenAttempt,
} from "./access";

const STAFF = "100000000000000001";
const BUG_STAFF = "100000000000000002";
const BLOCKED = "100000000000000003";
const VERIFIED = "100000000000000004";

const attempt = (patch: Partial<OpenAttempt> = {}): OpenAttempt => ({
  member: { roleIds: [], timedOut: false },
  settings: { staff_role_id: STAFF, blocked_role_ids: [], max_open_per_user: null, claim_hides_from_other_staff: false },
  category: {
    name: "Bug",
    slug: "bug",
    staff_role_ids: [],
    required_role_ids: [],
    member_limit: null,
    total_limit: null,
    cooldown_seconds: 0,
  },
  stats: { openTotal: 0, openByCategory: new Map(), lastOpenedByCategory: new Map() },
  openInCategory: 0,
  channelsInParent: 0,
  now: Date.parse("2026-09-17T12:00:00Z"),
  ...patch,
});

describe("who can open a ticket", () => {
  test("nothing configured means anyone can", () => {
    expect(whyCannotOpen(attempt())).toBeNull();
  });

  test("a blocked role, a timeout, or a missing required role stops it", () => {
    const base = attempt();
    expect(
      whyCannotOpen({ ...base, member: { roleIds: [BLOCKED], timedOut: false }, settings: { ...base.settings, blocked_role_ids: [BLOCKED] } }),
    ).toContain("can't open tickets");
    expect(whyCannotOpen({ ...base, member: { roleIds: [], timedOut: true } })).toContain("timed out");
    expect(whyCannotOpen({ ...base, category: { ...base.category, required_role_ids: [VERIFIED] } })).toContain("role needed");
    expect(
      whyCannotOpen({ ...base, member: { roleIds: [VERIFIED], timedOut: false }, category: { ...base.category, required_role_ids: [VERIFIED] } }),
    ).toBeNull();
  });

  test("every required role is needed, not just one", () => {
    const base = attempt();
    expect(
      whyCannotOpen({ ...base, member: { roleIds: [VERIFIED], timedOut: false }, category: { ...base.category, required_role_ids: [VERIFIED, STAFF] } }),
    ).toContain("role needed");
  });

  test("the server-wide limit counts every category", () => {
    const base = attempt();
    const stats = { openTotal: 2, openByCategory: new Map([["feature", 2]]), lastOpenedByCategory: new Map() };
    expect(whyCannotOpen({ ...base, stats, settings: { ...base.settings, max_open_per_user: 2 } })).toContain("2 tickets open");
    expect(whyCannotOpen({ ...base, stats, settings: { ...base.settings, max_open_per_user: 3 } })).toBeNull();
  });

  test("the category limit counts only that category", () => {
    const base = attempt();
    const stats = { openTotal: 1, openByCategory: new Map([["bug", 1]]), lastOpenedByCategory: new Map() };
    expect(whyCannotOpen({ ...base, stats, category: { ...base.category, member_limit: 1 } })).toBe(
      "You already have a Bug ticket open. Finish that one first.",
    );
    const elsewhere = { openTotal: 1, openByCategory: new Map([["feature", 1]]), lastOpenedByCategory: new Map() };
    expect(whyCannotOpen({ ...base, stats: elsewhere, category: { ...base.category, member_limit: 1 } })).toBeNull();
  });

  test("a cooldown runs from the newest ticket in that category", () => {
    const base = attempt();
    const stats = (iso: string) => ({ openTotal: 0, openByCategory: new Map(), lastOpenedByCategory: new Map([["bug", iso]]) });
    const category = { ...base.category, cooldown_seconds: 600 };
    expect(whyCannotOpen({ ...base, category, stats: stats("2026-09-17T11:55:00Z") })).toContain("Try again in 5 minutes");
    expect(whyCannotOpen({ ...base, category, stats: stats("2026-09-17T11:49:00Z") })).toBeNull();
  });

  test("a full category, by its own limit or Discord's 50 channels", () => {
    const base = attempt();
    expect(whyCannotOpen({ ...base, openInCategory: 10, category: { ...base.category, total_limit: 10 } })).toContain("full right now");
    expect(whyCannotOpen({ ...base, channelsInParent: 50 })).toContain("full right now");
    expect(whyCannotOpen({ ...base, channelsInParent: 49 })).toBeNull();
  });
});

describe("staff", () => {
  test("server-wide role plus the category's, deduplicated", () => {
    expect(staffRoleIds({ staff_role_id: STAFF }, { staff_role_ids: [BUG_STAFF, STAFF] })).toEqual([STAFF, BUG_STAFF]);
    expect(staffRoleIds(null, null)).toEqual([]);
  });

  test("category staff are staff on that category only", () => {
    const bugStaff = { canManageGuild: false, roleIds: [BUG_STAFF] };
    expect(isStaffMember(bugStaff, { staff_role_id: STAFF }, { staff_role_ids: [BUG_STAFF] })).toBe(true);
    expect(isStaffMember(bugStaff, { staff_role_id: STAFF }, { staff_role_ids: [] })).toBe(false);
    expect(isStaffMember(bugStaff, { staff_role_id: STAFF })).toBe(false);
  });

  test("Manage Server is always staff, even with nothing set up", () => {
    expect(isStaffMember({ canManageGuild: true, roleIds: [] }, null)).toBe(true);
  });
});

describe("ticket channel permissions", () => {
  const input = {
    everyoneRoleId: "1",
    botId: "9",
    settings: { staff_role_id: STAFF, claim_hides_from_other_staff: false },
    category: { staff_role_ids: [BUG_STAFF] },
    ticket: { opener_discord_user_id: "500", claimed_by_discord_user_id: null },
    memberIds: ["600"],
  };
  const ids = (overwrites: ReturnType<typeof computeTicketOverwrites>, type: OverwriteType) =>
    overwrites.filter((o) => o.type === type && "allow" in o).map((o) => o.id);

  test("everyone is locked out; opener, added members, staff roles and the bot are in", () => {
    const overwrites = computeTicketOverwrites(input);
    expect(overwrites[0]).toEqual({ id: "1", type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] });
    expect(ids(overwrites, OverwriteType.Role)).toEqual([STAFF, BUG_STAFF]);
    expect(ids(overwrites, OverwriteType.Member)).toEqual(["600", "500", "9"]);
  });

  test("a hidden claim drops the staff roles and keeps the claimer", () => {
    const overwrites = computeTicketOverwrites({
      ...input,
      settings: { staff_role_id: STAFF, claim_hides_from_other_staff: true },
      ticket: { opener_discord_user_id: "500", claimed_by_discord_user_id: "700" },
    });
    expect(ids(overwrites, OverwriteType.Role)).toEqual([]);
    expect(ids(overwrites, OverwriteType.Member)).toEqual(["600", "500", "700", "9"]);
  });

  test("hiding only applies while claimed", () => {
    const overwrites = computeTicketOverwrites({
      ...input,
      settings: { staff_role_id: STAFF, claim_hides_from_other_staff: true },
    });
    expect(ids(overwrites, OverwriteType.Role)).toEqual([STAFF, BUG_STAFF]);
  });

  test("an anonymised opener gets no overwrite", () => {
    const overwrites = computeTicketOverwrites({
      ...input,
      ticket: { opener_discord_user_id: "deleted", claimed_by_discord_user_id: null },
    });
    expect(ids(overwrites, OverwriteType.Member)).toEqual(["600", "9"]);
  });
});

describe("channel names", () => {
  const values = { "ticket.number": "0012", "member.name": "Wümpus The 3rd!", "ticket.category": "Bug" };

  test("the default template", () => {
    expect(renderChannelName("ticket-[ticket.number]", values, "ticket-0012")).toBe("ticket-0012");
  });

  test("names are made safe for Discord", () => {
    expect(renderChannelName("[ticket.category]-[member.name]", values, "x")).toBe("bug-wumpus-the-3rd");
  });

  test("a template that renders to nothing falls back", () => {
    expect(renderChannelName("[member.name]", { "member.name": "🎮🎮" }, "ticket-0012")).toBe("ticket-0012");
  });
});
