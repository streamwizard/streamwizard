import { describe, expect, test } from "bun:test";
import path from "node:path";
import {
  buildVoiceHelpEmbed,
  buildVoiceInviteModal,
  buildVoicePanelButtons,
  buildVoiceSettingsEmbed,
  commandMention,
  SETTINGS_BANNED_SHOWN,
  VOICE_HELP_GROUPS,
  VOICE_HELP_LEFT_OUT,
  VOICE_INVITE_BUTTON_ID,
  VOICE_INVITE_MEMBERS_FIELD,
  VOICE_RESET_BUTTON_ID,
  type HelpCommand,
  type VoiceSettingsView,
} from "./help";

const listed: string[] = VOICE_HELP_GROUPS.flatMap((group) => [...group.commands]);

function commands(...list: HelpCommand[]): Map<string, HelpCommand> {
  return new Map(list.map((command) => [command.name, command]));
}

function description(commandMap: Map<string, HelpCommand>, ids = new Map<string, string>()): string {
  return buildVoiceHelpEmbed(commandMap, ids).toJSON().description ?? "";
}

describe("VOICE_HELP_GROUPS", () => {
  test("lists every /voice-* command exactly once, except the staff-only ones", async () => {
    const dir = path.join(import.meta.dir, "..", "..", "commands", "voice");
    const files: string[] = [];
    for await (const file of new Bun.Glob("*.ts").scan({ cwd: dir })) files.push(path.basename(file, ".ts"));

    expect([...listed, ...VOICE_HELP_LEFT_OUT].sort()).toEqual(files.sort());
    expect(listed.some((name) => (VOICE_HELP_LEFT_OUT as readonly string[]).includes(name))).toBe(false);
    expect(new Set(listed).size).toBe(listed.length);
  });
});

describe("commandMention", () => {
  test("is a clickable mention when the id is known", () => {
    expect(commandMention("voice-lock", "123")).toBe("</voice-lock:123>");
  });

  test("falls back to plain text without an id", () => {
    expect(commandMention("voice-lock", undefined)).toBe("`/voice-lock`");
  });
});

describe("buildVoiceHelpEmbed", () => {
  const lock = { name: "voice-lock", description: "Lock the temporary voice channel" };
  const claim = { name: "voice-claim", description: "Claim ownership of the temporary voice channel" };
  const clean = { name: "voice-clean", description: "Delete all the inactive temporary channels" };

  test("puts groups in order, each command with its description underneath", () => {
    const text = description(commands(clean, claim, lock), new Map([["voice-lock", "1"]]));
    expect(text).toContain("**For the owner and voice staff**\n</voice-lock:1>\nLock the temporary voice channel");
    expect(text.indexOf("For the owner")).toBeLessThan(text.indexOf("For anyone"));
    expect(text).toContain("`/voice-claim`\nClaim ownership");
  });

  test("leaves out staff commands even when they're registered", () => {
    expect(description(commands(clean, lock))).not.toContain("voice-clean");
  });

  test("shows required options only", () => {
    const limit = {
      name: "voice-limit",
      description: "Change the user limit of the temporary voice channel",
      options: [
        { name: "user_limit", required: true },
        { name: "reason", required: false },
      ],
    };
    const text = description(commands(limit));
    expect(text).toContain("`/voice-limit` `[user_limit]`\n");
    expect(text).not.toContain("[reason]");
  });

  test("leaves out unregistered commands and empty groups", () => {
    const text = description(commands(lock));
    expect(text).not.toContain("voice-unlock");
    expect(text).not.toContain("For anyone");
  });

  test("fits Discord's 4096 character limit with every command and long ids", () => {
    const all = commands(
      ...listed.map((name) => ({
        name,
        description: "x".repeat(100),
        options: [{ name: "member_or_value", required: true }],
      })),
    );
    const ids = new Map(listed.map((name) => [name, "1".repeat(20)]));
    expect(description(all, ids).length).toBeLessThanOrEqual(4096);
  });
});

describe("buildVoiceSettingsEmbed", () => {
  const base: VoiceSettingsView = { ownerId: "1", locked: false, hidden: false, userLimit: 0, bannedUserIds: [], remembers: true };
  const field = (view: VoiceSettingsView, name: string) =>
    buildVoiceSettingsEmbed(view).toJSON().fields?.find((f) => f.name === name)?.value;

  test("a fresh channel: open, no limit, nobody banned", () => {
    expect(field(base, "Owner")).toBe("<@1>");
    expect(field(base, "Access")).toBe("Open");
    expect(field(base, "User limit")).toBe("No limit");
    expect(field(base, "Banned")).toBe("Nobody");
  });

  test("access says locked, hidden or both", () => {
    expect(field({ ...base, locked: true }, "Access")).toBe("Locked");
    expect(field({ ...base, hidden: true }, "Access")).toBe("Hidden");
    expect(field({ ...base, locked: true, hidden: true }, "Access")).toBe("Locked and hidden");
  });

  test("shows the limit and the banned people", () => {
    expect(field({ ...base, userLimit: 5 }, "User limit")).toBe("5 people");
    expect(field({ ...base, bannedUserIds: ["2", "3"] }, "Banned")).toBe("<@2>, <@3>");
  });

  test("a long ban list ends in a count", () => {
    const ids = Array.from({ length: SETTINGS_BANNED_SHOWN + 3 }, (_, i) => String(i + 10));
    expect(field({ ...base, bannedUserIds: ids }, "Banned")).toEndWith("and 3 more");
  });

  test("a Renaming row shows up only while the owner is blocked", () => {
    expect(field({ ...base, renameBlocked: true }, "Renaming")).toBe("Blocked by voice staff");
    expect(field(base, "Renaming")).toBeUndefined();
  });

  test("the footer says whether the lobby remembers, and is gone with the lobby", () => {
    expect(buildVoiceSettingsEmbed(base).toJSON().footer?.text).toBe("Your next channel from this lobby starts with these.");
    expect(buildVoiceSettingsEmbed({ ...base, remembers: false }).toJSON().footer?.text).toBe("This lobby doesn't remember settings.");
    expect(buildVoiceSettingsEmbed({ ...base, remembers: null }).toJSON().footer).toBeUndefined();
  });
});

describe("buildVoicePanelButtons", () => {
  test("Invite sits left of Reset", () => {
    const [invite, reset] = buildVoicePanelButtons().toJSON().components;
    expect(invite).toMatchObject({ custom_id: VOICE_INVITE_BUTTON_ID, label: "Invite" });
    expect(reset).toMatchObject({ custom_id: VOICE_RESET_BUTTON_ID, label: "Reset to defaults" });
  });
});

describe("buildVoiceInviteModal", () => {
  test("with a link: the link to copy, then the member picker", () => {
    const json = JSON.stringify(buildVoiceInviteModal({ ok: true, url: "https://discord.gg/abc" }).toJSON());
    expect(json).toContain("https://discord.gg/abc");
    expect(json).toContain(VOICE_INVITE_MEMBERS_FIELD);
  });

  test("without one: says why, and still offers the member picker", () => {
    const json = JSON.stringify(buildVoiceInviteModal({ ok: false, refusal: "No links here." }).toJSON());
    expect(json).toContain("No links here.");
    expect(json).toContain(VOICE_INVITE_MEMBERS_FIELD);
  });
});
