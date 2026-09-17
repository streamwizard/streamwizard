import { PermissionFlagsBits, type GuildMember } from "discord.js";
import type { DiscordTicketSettings } from "@repo/supabase/queries/tickets";

// Staff = anyone with the configured staff role, or anyone who can Manage Server
// (so admins always have access even before a staff role is set).
export function isStaff(member: GuildMember, settings: DiscordTicketSettings | null): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  return Boolean(settings?.staff_role_id && member.roles.cache.has(settings.staff_role_id));
}
