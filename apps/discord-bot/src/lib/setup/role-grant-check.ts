/**
 * Can this member make the bot hand out this role?
 *
 * The bot grants the verified role with its own Manage Roles permission. /setup
 * only required Manage Server, so a member without Manage Roles (or with it,
 * but below the role) could pick any role under the bot's and have the bot give
 * it to everyone who links an account: a confused deputy. The rule here is the
 * one Discord applies to the member themselves: the owner, or Manage Roles and
 * a highest role above the one picked. The role must also sit below the bot's
 * highest role, and @everyone and integration-managed roles are never allowed.
 *
 * Pure so it can be tested without a gateway; setup-wizard.ts fills it in from
 * the interaction.
 */
export interface RoleGrantCheck {
  role: { id: string; position: number; managed: boolean } | null;
  guildId: string;
  /** Position of the bot's highest role; null when the bot member isn't cached. */
  botHighestPosition: number | null;
  isOwner: boolean;
  hasManageRoles: boolean;
  actorHighestPosition: number;
}

export function whyCannotHandOut(check: RoleGrantCheck): string | null {
  const { role } = check;
  if (!role) return "That role doesn't exist any more. Pick another one.";
  if (role.id === check.guildId) return "@everyone can't be the verified role. Pick another role.";
  if (role.managed) return "That role belongs to an integration, so it can't be handed out. Pick another role.";
  if (check.botHighestPosition === null || role.position >= check.botHighestPosition) {
    return "That role is above the StreamWizard bot's own role, so it can't hand it out. Move the bot's role higher or pick a lower role.";
  }
  if (check.isOwner) return null;
  if (!check.hasManageRoles) return "You need Manage Roles to pick the role the bot hands out.";
  if (role.position >= check.actorHighestPosition) return "Pick a role below your own highest role.";
  return null;
}
