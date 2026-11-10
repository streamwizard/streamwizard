import { describe, expect, it } from "bun:test";
import type { User } from "@supabase/supabase-js";
import { loadDashboardLayoutData } from "./layout-data";

const USER = { id: "u1" } as User;

/**
 * Every dependency records when it starts and waits for the test to let it
 * finish, so a test can see which reads were in flight at the same time.
 */
function setup(overrides: { onboardingCompleted?: boolean; discordUserId?: string | null; roleIds?: string[] | null } = {}) {
  const started: string[] = [];
  const gates = new Map<string, () => void>();
  const gated =
    <T>(name: string, value: T) =>
    () => {
      started.push(name);
      return new Promise<T>((resolve) => gates.set(name, () => resolve(value)));
    };
  const release = (...names: string[]) => {
    for (const name of names) gates.get(name)?.();
  };

  const deps = {
    getUser: gated("user", USER),
    getPreferences: gated("prefs", { onboarding_completed: overrides.onboardingCompleted ?? true }),
    hasCloudObsAccess: gated("access", true),
    getFolders: gated("folders", [{ id: "f1" }] as never),
    getFolderClipCounts: gated("counts", { f1: 3 }),
    countClips: gated("clipCount", 7),
    getDiscordUserId: gated("discordUser", overrides.discordUserId ?? null),
    getVerifiedRoleId: gated("verifiedRole", "role-verified"),
    getMemberRoleIds: gated("memberRoles", overrides.roleIds ?? null),
  };
  return { deps, started, release };
}

/** Lets pending promise callbacks run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Lets the two read rounds and the Discord account lookup finish, in order. */
async function releaseUpToDiscord(release: (...names: string[]) => void) {
  for (const round of [["user", "prefs", "access"], ["folders", "counts", "clipCount"], ["discordUser"]]) {
    await flush();
    release(...round);
  }
}

describe("loadDashboardLayoutData", () => {
  it("runs the reads in two parallel rounds", async () => {
    const { deps, started, release } = setup();
    const result = loadDashboardLayoutData(deps);

    await flush();
    // Round one: everything that needs no user id, alongside the auth check.
    expect(started).toEqual(["user", "prefs", "access"]);

    release("user", "prefs", "access");
    await flush();
    // Round two: the per-user reads, together.
    expect(started.slice(3)).toEqual(["folders", "counts", "clipCount"]);

    release("folders", "counts", "clipCount");
    expect(await result).toEqual({
      user: USER,
      folders: [{ id: "f1" }] as never,
      folderClipCounts: { f1: 3 },
      clipCount: 7,
      onboardingCompleted: true,
      discordStatus: "not_linked",
      hasCloudObsAccess: true,
    });
    // Past onboarding, Discord is never asked.
    expect(started).not.toContain("discordUser");
  });

  it("checks Discord membership while onboarding is in progress", async () => {
    const { deps, started, release } = setup({
      onboardingCompleted: false,
      discordUserId: "d1",
      roleIds: ["role-verified", "other"],
    });
    const result = loadDashboardLayoutData(deps);

    await flush();
    release("user", "prefs", "access");
    await flush();
    release("folders", "counts", "clipCount");
    await flush();
    expect(started.at(-1)).toBe("discordUser");
    release("discordUser");
    await flush();
    expect(started.slice(-2)).toEqual(["verifiedRole", "memberRoles"]);
    release("verifiedRole", "memberRoles");

    const data = await result;
    expect(data.discordStatus).toBe("verified");
    expect(data.onboardingCompleted).toBe(false);
  });

  it("calls a linked account without the role not_member", async () => {
    const { deps, release } = setup({ onboardingCompleted: false, discordUserId: "d1", roleIds: ["other"] });
    const result = loadDashboardLayoutData(deps);
    await releaseUpToDiscord(release);
    await flush();
    release("verifiedRole", "memberRoles");
    expect((await result).discordStatus).toBe("not_member");
  });

  it("calls an unlinked account not_linked without asking Discord for roles", async () => {
    const { deps, started, release } = setup({ onboardingCompleted: false, discordUserId: null });
    const result = loadDashboardLayoutData(deps);
    await releaseUpToDiscord(release);
    expect((await result).discordStatus).toBe("not_linked");
    expect(started).not.toContain("memberRoles");
  });

  it("falls back to no folder counts when counting fails, and no folders when none load", async () => {
    const result = await loadDashboardLayoutData({
      getUser: async () => USER,
      getPreferences: async () => null,
      hasCloudObsAccess: async () => false,
      getFolders: async () => null,
      getFolderClipCounts: async () => {
        throw new Error("count failed");
      },
      countClips: async () => 0,
      getDiscordUserId: async () => null,
      getVerifiedRoleId: async () => null,
      getMemberRoleIds: async () => null,
    });

    expect(result.folders).toEqual([]);
    expect(result.folderClipCounts).toEqual({});
    // No preferences row means onboarding hasn't been finished.
    expect(result.onboardingCompleted).toBe(false);
  });
});
