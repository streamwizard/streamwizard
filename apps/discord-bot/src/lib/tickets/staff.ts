import { PermissionFlagsBits, type GuildMember } from "discord.js";
import type { TicketCategory } from "@repo/supabase/queries/ticket-config";
import type { DiscordTicketSettings } from "@repo/supabase/queries/tickets";
import { isStaffMember } from "./access";

/**
 * Staff on a ticket of `category`: Manage Server, the server-wide staff role,
 * or one of the category's staff roles. Pass no category for things that
 * aren't about one ticket; only the first two count then.
 */
export function isStaff(
  member: GuildMember,
  settings: DiscordTicketSettings | null,
  category?: TicketCategory | null,
): boolean {
  return isStaffMember(
    { canManageGuild: member.permissions.has(PermissionFlagsBits.ManageGuild), roleIds: [...member.roles.cache.keys()] },
    settings,
    category,
  );
}
