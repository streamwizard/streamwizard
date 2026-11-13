import { describe, expect, test } from "bun:test";
import type { SmpWaitlistApplication } from "@repo/supabase/queries/smp/waitlist";
import { applyToSmpWaitlist, changeSmpMinecraftName, SMP_MESSAGES, type SmpApplyDeps, type SmpRenameDeps } from "./apply";

const VALUES = { minecraftUsername: "notch", averageViewers: 12, streamLanguage: "nl", streamFrequency: "weekly" } as const;
const FOUND = { status: "found", uuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5", name: "Notch" } as const;
const TWITCH = { broadcasterType: "affiliate", followerCount: 340 } as const;

function applyDeps(overrides: Partial<SmpApplyDeps> = {}) {
  const inserted: SmpWaitlistApplication[] = [];
  const lookups: string[] = [];
  const deps: SmpApplyDeps = {
    hasEntry: async () => false,
    getDiscordStatus: async () => "verified",
    resolveProfile: async (name) => {
      lookups.push(name);
      return FOUND;
    },
    getTwitchSnapshot: async () => TWITCH,
    insertEntry: async (application) => {
      inserted.push(application);
      return "ok";
    },
    ...overrides,
  };
  return { deps, inserted, lookups };
}

describe("applyToSmpWaitlist", () => {
  test("stores Mojang's name and UUID with the answers and the Twitch snapshot", async () => {
    const { deps, inserted } = applyDeps();
    expect(await applyToSmpWaitlist(deps, VALUES)).toEqual({ success: true, twitch: TWITCH });
    expect(inserted).toEqual([
      {
        minecraft_username: "Notch",
        minecraft_uuid: FOUND.uuid,
        average_viewers: 12,
        stream_language: "nl",
        stream_frequency: "weekly",
        twitch_broadcaster_type: "affiliate",
        twitch_follower_count: 340,
      },
    ]);
  });

  test("applies without a Twitch snapshot when Twitch gave none", async () => {
    const { deps, inserted } = applyDeps({ getTwitchSnapshot: async () => ({ broadcasterType: null, followerCount: null }) });
    expect((await applyToSmpWaitlist(deps, VALUES)).success).toBe(true);
    expect(inserted[0]).toMatchObject({ twitch_broadcaster_type: null, twitch_follower_count: null });
  });

  test("refuses a second application before asking Discord or Mojang", async () => {
    const { deps, inserted, lookups } = applyDeps({
      hasEntry: async () => true,
      getDiscordStatus: async () => {
        throw new Error("should not be asked");
      },
    });
    expect(await applyToSmpWaitlist(deps, VALUES)).toEqual({ success: false, error: SMP_MESSAGES.alreadyApplied });
    expect(lookups).toEqual([]);
    expect(inserted).toEqual([]);
  });

  for (const status of ["not_linked", "not_member"] as const) {
    test(`refuses a caller whose Discord status is ${status}`, async () => {
      const { deps, inserted, lookups } = applyDeps({ getDiscordStatus: async () => status });
      expect(await applyToSmpWaitlist(deps, VALUES)).toEqual({ success: false, error: SMP_MESSAGES.discordFirst });
      expect(lookups).toEqual([]);
      expect(inserted).toEqual([]);
    });
  }

  test("an unknown Minecraft name stores nothing", async () => {
    const { deps, inserted } = applyDeps({ resolveProfile: async () => ({ status: "not_found" }) });
    expect(await applyToSmpWaitlist(deps, VALUES)).toEqual({ success: false, error: SMP_MESSAGES.nameNotFound, field: "minecraftUsername" });
    expect(inserted).toEqual([]);
  });

  test("Mojang being down stores nothing and says to retry", async () => {
    const { deps, inserted } = applyDeps({ resolveProfile: async () => ({ status: "unavailable" }) });
    expect(await applyToSmpWaitlist(deps, VALUES)).toEqual({ success: false, error: SMP_MESSAGES.mojangDown });
    expect(inserted).toEqual([]);
  });

  test("a Minecraft account someone else applied with is named as the problem", async () => {
    const { deps } = applyDeps({ insertEntry: async () => "minecraft_account_taken" });
    expect(await applyToSmpWaitlist(deps, VALUES)).toEqual({ success: false, error: SMP_MESSAGES.accountTaken, field: "minecraftUsername" });
  });

  test("losing a race with your own second tab reads as already applied", async () => {
    const { deps } = applyDeps({ insertEntry: async () => "already_applied" });
    expect(await applyToSmpWaitlist(deps, VALUES)).toEqual({ success: false, error: SMP_MESSAGES.alreadyApplied });
  });
});

describe("changeSmpMinecraftName", () => {
  function renameDeps(overrides: Partial<SmpRenameDeps> = {}) {
    const updates: unknown[] = [];
    const deps: SmpRenameDeps = {
      resolveProfile: async () => FOUND,
      updateAccount: async (account) => {
        updates.push(account);
        return "ok";
      },
      ...overrides,
    };
    return { deps, updates };
  }

  test("writes the resolved name and UUID together", async () => {
    const { deps, updates } = renameDeps();
    expect(await changeSmpMinecraftName(deps, { minecraftUsername: "notch" })).toEqual({ success: true });
    expect(updates).toEqual([{ minecraft_username: "Notch", minecraft_uuid: FOUND.uuid }]);
  });

  test("an unknown name changes nothing", async () => {
    const { deps, updates } = renameDeps({ resolveProfile: async () => ({ status: "not_found" }) });
    expect(await changeSmpMinecraftName(deps, { minecraftUsername: "nobody" })).toEqual({
      success: false,
      error: SMP_MESSAGES.nameNotFound,
      field: "minecraftUsername",
    });
    expect(updates).toEqual([]);
  });

  test("a reviewed application keeps its Minecraft account", async () => {
    const { deps } = renameDeps({ updateAccount: async () => "not_pending" });
    expect(await changeSmpMinecraftName(deps, { minecraftUsername: "notch" })).toEqual({
      success: false,
      error: SMP_MESSAGES.reviewed,
    });
  });

  test("a name that belongs to another applicant is refused", async () => {
    const { deps } = renameDeps({ updateAccount: async () => "minecraft_account_taken" });
    expect(await changeSmpMinecraftName(deps, { minecraftUsername: "notch" })).toEqual({
      success: false,
      error: SMP_MESSAGES.accountTaken,
      field: "minecraftUsername",
    });
  });
});
