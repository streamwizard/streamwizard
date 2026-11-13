/**
 * Where a user stands with the StreamWizard Discord: no account linked, linked
 * but without the Verified Member role, or verified. The bot grants that role
 * when a linked user is in the server, so "verified" means linked and joined.
 *
 * Used by the onboarding wizard (through the dashboard layout) and the SMP
 * sign-up on /smp.
 */
export type DiscordStatus = "verified" | "not_member" | "not_linked";

/** The three reads behind the status. Passed in, so it runs without a DB or Discord in tests. */
export interface DiscordStatusDeps {
  getDiscordUserId: (userId: string) => Promise<string | null>;
  getVerifiedRoleId: () => Promise<string | null>;
  getMemberRoleIds: (discordUserId: string) => Promise<string[] | null>;
}

export async function getDiscordStatus(deps: DiscordStatusDeps, userId: string): Promise<DiscordStatus> {
  const discordUserId = await deps.getDiscordUserId(userId);
  if (!discordUserId) return "not_linked";
  const [verifiedRoleId, roleIds] = await Promise.all([
    deps.getVerifiedRoleId(),
    deps.getMemberRoleIds(discordUserId),
  ]);
  return roleIds && verifiedRoleId && roleIds.includes(verifiedRoleId) ? "verified" : "not_member";
}
