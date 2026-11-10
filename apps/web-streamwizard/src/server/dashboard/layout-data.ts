import type { User } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";

type ClipFolder = Database["public"]["Tables"]["clip_folders"]["Row"];

export type DiscordStatus = "verified" | "not_member" | "not_linked";

/** What the dashboard layout reads. Passed in, so the loader runs without a DB in tests. */
interface DashboardLayoutDeps {
  getUser: () => Promise<User>;
  getPreferences: () => Promise<{ onboarding_completed: boolean | null } | null>;
  hasCloudObsAccess: () => Promise<boolean>;
  getFolders: (userId: string) => Promise<ClipFolder[] | null>;
  getFolderClipCounts: (userId: string) => Promise<Record<string, number>>;
  countClips: (userId: string) => Promise<number>;
  getDiscordUserId: (userId: string) => Promise<string | null>;
  getVerifiedRoleId: () => Promise<string | null>;
  getMemberRoleIds: (discordUserId: string) => Promise<string[] | null>;
}

export interface DashboardLayoutData {
  user: User;
  folders: ClipFolder[];
  folderClipCounts: Record<string, number>;
  clipCount: number;
  onboardingCompleted: boolean;
  discordStatus: DiscordStatus;
  hasCloudObsAccess: boolean;
}

/**
 * Everything the dashboard shell needs, in as few round trips as the data
 * allows: the reads that need no user id go out with the auth check, the
 * per-user ones together after it. Only the Discord check waits on the
 * preferences, and only while onboarding is still in progress.
 */
export async function loadDashboardLayoutData(deps: DashboardLayoutDeps): Promise<DashboardLayoutData> {
  const [user, prefs, hasCloudObsAccess] = await Promise.all([
    deps.getUser(),
    deps.getPreferences(),
    deps.hasCloudObsAccess(),
  ]);

  const [folders, folderClipCounts, clipCount] = await Promise.all([
    deps.getFolders(user.id),
    deps.getFolderClipCounts(user.id).catch((err: unknown) => {
      console.error("Failed to count clips per folder:", err);
      return {} as Record<string, number>;
    }),
    deps.countClips(user.id),
  ]);

  const onboardingCompleted = !!prefs?.onboarding_completed;
  // Only checked while onboarding is still in progress — avoids an extra
  // Discord REST call on every dashboard page load for everyone past it.
  const discordStatus = onboardingCompleted ? "not_linked" : await getDiscordStatus(deps, user.id);

  return {
    user,
    folders: folders ?? [],
    folderClipCounts,
    clipCount,
    onboardingCompleted,
    discordStatus,
    hasCloudObsAccess,
  };
}

async function getDiscordStatus(deps: DashboardLayoutDeps, userId: string): Promise<DiscordStatus> {
  const discordUserId = await deps.getDiscordUserId(userId);
  if (!discordUserId) return "not_linked";
  const [verifiedRoleId, roleIds] = await Promise.all([
    deps.getVerifiedRoleId(),
    deps.getMemberRoleIds(discordUserId),
  ]);
  return roleIds && verifiedRoleId && roleIds.includes(verifiedRoleId) ? "verified" : "not_member";
}
