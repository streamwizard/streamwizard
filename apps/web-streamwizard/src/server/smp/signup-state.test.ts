import { describe, expect, test } from "bun:test";
import type { DiscordStatus } from "@/server/discord/status";
import { loadSmpSignupState, type SmpSignupDeps } from "./signup-state";

const ENTRY = { status: "pending", minecraft_username: "Steve_01", minecraft_uuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5" };

function setup(overrides: Partial<SmpSignupDeps> & { discordStatus?: DiscordStatus } = {}) {
  const calls: string[] = [];
  const reported: string[] = [];
  const called =
    <T>(name: string, value: T) =>
    async () => {
      calls.push(name);
      return value;
    };
  const deps: SmpSignupDeps = {
    getUserId: called("user", "user-1"),
    getEntry: called("entry", null),
    getDiscordStatus: called("discord", overrides.discordStatus ?? "verified"),
    getStreamLanguage: called("language", "nl" as const),
    reportError: (_error, context) => reported.push(context),
    ...overrides,
  };
  return { deps, calls, reported };
}

describe("loadSmpSignupState", () => {
  test("a visitor who is not signed in costs no further reads", async () => {
    const { deps, calls } = setup({ getUserId: async () => null });
    expect(await loadSmpSignupState(deps)).toEqual({ step: "signed_out" });
    expect(calls).toEqual([]);
  });

  test("someone on the waitlist sees the done state without a Discord call", async () => {
    const { deps, calls } = setup({ getEntry: async () => ENTRY });
    expect(await loadSmpSignupState(deps)).toEqual({ step: "done", entry: ENTRY });
    expect(calls).toEqual(["user"]);
  });

  test("no Discord account linked is step two", async () => {
    const { deps, calls } = setup({ discordStatus: "not_linked" });
    expect(await loadSmpSignupState(deps)).toEqual({ step: "link_discord" });
    expect(calls).not.toContain("language");
  });

  test("linked but not in the server is step three", async () => {
    const { deps } = setup({ discordStatus: "not_member" });
    expect(await loadSmpSignupState(deps)).toEqual({ step: "join_discord" });
  });

  test("verified opens the form on the channel's language", async () => {
    const { deps } = setup();
    expect(await loadSmpSignupState(deps)).toEqual({ step: "form", streamLanguage: "nl" });
  });

  test("a failed language lookup still opens the form", async () => {
    const { deps, reported } = setup({
      getStreamLanguage: async () => {
        throw new Error("twitch");
      },
    });
    expect(await loadSmpSignupState(deps)).toEqual({ step: "form", streamLanguage: null });
    expect(reported).toEqual([]);
  });

  test("a failed Discord check is reported and is not mistaken for an unlinked account", async () => {
    const { deps, reported } = setup({
      getDiscordStatus: async () => {
        throw new Error("discord down");
      },
    });
    expect(await loadSmpSignupState(deps)).toEqual({ step: "unavailable" });
    expect(reported).toEqual(["smp.signup-state"]);
  });

  test("a failed waitlist read is unavailable too, not an empty form", async () => {
    const { deps, calls } = setup({
      getEntry: async () => {
        throw new Error("db down");
      },
    });
    expect(await loadSmpSignupState(deps)).toEqual({ step: "unavailable" });
    expect(calls).not.toContain("discord");
  });
});
