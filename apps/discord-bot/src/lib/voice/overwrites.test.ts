import { describe, expect, test } from "bun:test";
import { OverwriteType, PermissionFlagsBits, type OverwriteData } from "discord.js";
import {
  BANNED_PERMISSIONS,
  BOT_PERMISSIONS,
  buildTempOverwrites,
  currentGuestIds,
  GUEST_PERMISSIONS,
  OWNER_PERMISSIONS,
  type RawOverwrite,
  type TempOverwriteInput,
} from "./overwrites";

const { ViewChannel, Connect, Speak } = PermissionFlagsBits;
const EVERYONE = "guild";
const MEMBERS_ROLE = "members";

const input = (overrides: Partial<TempOverwriteInput> = {}): TempOverwriteInput => ({
  parent: [],
  everyoneId: EVERYONE,
  botId: "bot",
  ownerId: "owner",
  locked: false,
  hidden: false,
  bannedUserIds: [],
  guestIds: [],
  ...overrides,
});

const find = (list: OverwriteData[], id: string) => list.find((o) => o.id === id);
const bits = (value: OverwriteData["allow"]) => (value ?? 0n) as bigint;

// A members-only category: @everyone can't see it, the Members role can.
const membersOnly: RawOverwrite[] = [
  { id: EVERYONE, type: OverwriteType.Role, allow: 0n, deny: ViewChannel },
  { id: MEMBERS_ROLE, type: OverwriteType.Role, allow: ViewChannel | Connect, deny: 0n },
];

describe("buildTempOverwrites", () => {
  test("a fresh channel: the category's rules plus the owner and the bot", () => {
    const list = buildTempOverwrites(input({ parent: membersOnly }));
    expect(find(list, EVERYONE)).toEqual({ id: EVERYONE, type: OverwriteType.Role, allow: 0n, deny: ViewChannel });
    expect(bits(find(list, MEMBERS_ROLE)?.allow)).toBe(ViewChannel | Connect);
    expect(find(list, "owner")).toEqual({ id: "owner", type: OverwriteType.Member, allow: OWNER_PERMISSIONS, deny: 0n });
    expect(find(list, "bot")).toEqual({ id: "bot", type: OverwriteType.Member, allow: BOT_PERMISSIONS, deny: 0n });
  });

  test("lock denies Connect to @everyone and strips it from roles the category allowed", () => {
    const list = buildTempOverwrites(input({ parent: membersOnly, locked: true }));
    expect(bits(find(list, EVERYONE)?.deny) & Connect).toBe(Connect);
    expect(bits(find(list, MEMBERS_ROLE)?.allow)).toBe(ViewChannel);
    expect(bits(find(list, "owner")?.allow) & Connect).toBe(Connect);
  });

  test("unlocking puts back exactly what the category had", () => {
    const list = buildTempOverwrites(input({ parent: membersOnly, locked: false }));
    expect(bits(find(list, EVERYONE)?.deny)).toBe(ViewChannel);
    expect(bits(find(list, MEMBERS_ROLE)?.allow)).toBe(ViewChannel | Connect);
  });

  test("hide adds an @everyone overwrite when the category has none", () => {
    const list = buildTempOverwrites(input({ hidden: true }));
    expect(find(list, EVERYONE)).toEqual({ id: EVERYONE, type: OverwriteType.Role, allow: 0n, deny: ViewChannel });
  });

  test("other role permissions survive a lock", () => {
    const parent: RawOverwrite[] = [{ id: MEMBERS_ROLE, type: OverwriteType.Role, allow: Connect | Speak, deny: 0n }];
    const list = buildTempOverwrites(input({ parent, locked: true }));
    expect(bits(find(list, MEMBERS_ROLE)?.allow)).toBe(Speak);
  });

  test("guests get back in only while the channel is locked or hidden", () => {
    expect(find(buildTempOverwrites(input({ guestIds: ["g"] })), "g")).toBeUndefined();
    expect(bits(find(buildTempOverwrites(input({ guestIds: ["g"], locked: true })), "g")?.allow)).toBe(GUEST_PERMISSIONS);
    expect(bits(find(buildTempOverwrites(input({ guestIds: ["g"], hidden: true })), "g")?.allow)).toBe(GUEST_PERMISSIONS);
  });

  test("banned members are denied View Channel and Connect, even as guests", () => {
    const list = buildTempOverwrites(input({ bannedUserIds: ["b"], guestIds: ["b"], locked: true }));
    expect(find(list, "b")).toEqual({ id: "b", type: OverwriteType.Member, allow: 0n, deny: BANNED_PERMISSIONS });
  });

  test("a stale ban never locks out the owner or the bot", () => {
    const list = buildTempOverwrites(input({ bannedUserIds: ["owner", "bot"] }));
    expect(find(list, "owner")?.deny).toBe(0n);
    expect(find(list, "bot")?.deny).toBe(0n);
  });

  test("drops overwrites that end up empty", () => {
    const parent: RawOverwrite[] = [{ id: MEMBERS_ROLE, type: OverwriteType.Role, allow: Connect, deny: 0n }];
    const list = buildTempOverwrites(input({ parent, locked: true }));
    expect(find(list, MEMBERS_ROLE)).toBeUndefined();
  });
});

describe("currentGuestIds", () => {
  test("member overwrites that allow Connect, minus owner, bot and banned", () => {
    const overwrites: RawOverwrite[] = [
      { id: EVERYONE, type: OverwriteType.Role, allow: 0n, deny: Connect },
      { id: MEMBERS_ROLE, type: OverwriteType.Role, allow: Connect, deny: 0n },
      { id: "owner", type: OverwriteType.Member, allow: OWNER_PERMISSIONS, deny: 0n },
      { id: "bot", type: OverwriteType.Member, allow: BOT_PERMISSIONS, deny: 0n },
      { id: "guest", type: OverwriteType.Member, allow: GUEST_PERMISSIONS, deny: 0n },
      { id: "previous-owner", type: OverwriteType.Member, allow: OWNER_PERMISSIONS, deny: 0n },
      { id: "banned", type: OverwriteType.Member, allow: 0n, deny: BANNED_PERMISSIONS },
    ];
    expect(currentGuestIds(overwrites, { ownerId: "owner", botId: "bot", bannedUserIds: ["banned"] })).toEqual([
      "guest",
      "previous-owner",
    ]);
  });
});
