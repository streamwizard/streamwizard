import { describe, expect, test } from "bun:test";
import { PermissionFlagsBits } from "discord.js";
import { matchAuditEntry } from "./audit";
import { diffFields, diffPermissions, diffRoleIds, hexColor, isIgnoredChannel, messageText } from "./refs";

describe("server log diff helpers", () => {
  test("diffRoleIds ignores @everyone", () => {
    expect(diffRoleIds(["g", "a", "b"], ["g", "b", "c"], "g")).toEqual({ added: ["c"], removed: ["a"] });
  });

  test("diffPermissions names added and removed permissions", () => {
    const before = PermissionFlagsBits.SendMessages | PermissionFlagsBits.ManageMessages;
    const after = PermissionFlagsBits.SendMessages | PermissionFlagsBits.BanMembers;
    expect(diffPermissions(before, after)).toEqual({ added: ["BanMembers"], removed: ["ManageMessages"] });
  });

  test("diffFields only returns changed keys", () => {
    expect(diffFields({ name: "a", nsfw: false, topic: null }, { name: "b", nsfw: false, topic: null })).toEqual({
      name: { from: "a", to: "b" },
    });
  });

  test("isIgnoredChannel matches the channel or its category", () => {
    expect(isIgnoredChannel(["cat"], "chan", "cat")).toBe(true);
    expect(isIgnoredChannel(["chan"], "chan", null)).toBe(true);
    expect(isIgnoredChannel(["other"], "chan", "cat")).toBe(false);
  });

  test("messageText keeps null (not cached) and caps long text", () => {
    expect(messageText(null)).toBeNull();
    expect(messageText("")).toBe("");
    expect(messageText("x".repeat(5000))?.length).toBe(1900);
  });

  test("hexColor", () => {
    expect(hexColor(0x9146ff)).toBe("#9146ff");
    expect(hexColor(0)).toBeNull();
  });
});

describe("audit log matching", () => {
  const now = 1_800_000_000_000;
  const entry = (targetId: string, ageMs: number, channelId?: string) => ({
    targetId,
    createdTimestamp: now - ageMs,
    extra: channelId ? { channel: { id: channelId }, count: 1 } : null,
  });

  test("matches a recent entry for the target", () => {
    const entries = [entry("other", 1000), entry("user", 2000)];
    expect(matchAuditEntry(entries as never[], { targetId: "user", now })).toBe(entries[1] as never);
  });

  test("ignores entries older than the window", () => {
    expect(matchAuditEntry([entry("user", 60_000)] as never[], { targetId: "user", now })).toBeNull();
  });

  test("checks the channel for message deletes", () => {
    const entries = [entry("user", 1000, "chan-a")];
    expect(matchAuditEntry(entries as never[], { targetId: "user", channelId: "chan-b", now })).toBeNull();
    expect(matchAuditEntry(entries as never[], { targetId: "user", channelId: "chan-a", now })).toBe(entries[0] as never);
  });
});
