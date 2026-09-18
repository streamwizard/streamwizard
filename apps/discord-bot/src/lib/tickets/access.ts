import { OverwriteType, PermissionFlagsBits, type OverwriteData } from "discord.js";
import type { TicketCategory } from "@repo/supabase/queries/ticket-config";
import type { OpenerTicketStats } from "@repo/supabase/queries/ticket-lifecycle";
import type { DiscordTicket, DiscordTicketSettings } from "@repo/supabase/queries/tickets";

// Who may open a ticket, who counts as staff on it, and who can see its
// channel. All of it is pure (ids and rows in, a decision out), so every rule
// here is tested without Discord.

type Settings = Pick<DiscordTicketSettings, "staff_role_id" | "blocked_role_ids" | "max_open_per_user" | "claim_hides_from_other_staff">;
type CategoryRules = Pick<
  TicketCategory,
  "name" | "slug" | "staff_role_ids" | "required_role_ids" | "member_limit" | "total_limit" | "cooldown_seconds"
>;

/** The server-wide staff role plus the category's own, without duplicates. */
export function staffRoleIds(settings: Pick<Settings, "staff_role_id"> | null, category?: Pick<TicketCategory, "staff_role_ids"> | null): string[] {
  return [...new Set([...(settings?.staff_role_id ? [settings.staff_role_id] : []), ...(category?.staff_role_ids ?? [])])];
}

/**
 * Staff on a ticket of `category`: Manage Server (so admins always have
 * access, even before a staff role is set), the server-wide staff role, or one
 * of the category's staff roles. Without a category, only the first two count.
 */
export function isStaffMember(
  member: { canManageGuild: boolean; roleIds: ReadonlySet<string> | readonly string[] },
  settings: Pick<Settings, "staff_role_id"> | null,
  category?: Pick<TicketCategory, "staff_role_ids"> | null,
): boolean {
  if (member.canManageGuild) return true;
  const roles = member.roleIds instanceof Set ? member.roleIds : new Set(member.roleIds);
  return staffRoleIds(settings, category).some((id) => roles.has(id));
}

export interface OpenAttempt {
  member: { roleIds: readonly string[]; timedOut: boolean };
  settings: Settings;
  category: CategoryRules;
  /** The member's own tickets. */
  stats: OpenerTicketStats;
  /** Open tickets in this category, all members. */
  openInCategory: number;
  /** Channels already under the Discord category the ticket would go in. Discord stops at 50. */
  channelsInParent: number;
  now?: number;
}

const DISCORD_CATEGORY_CHANNELS = 50;

const waitText = (seconds: number): string => {
  if (seconds < 90) return `${Math.max(1, Math.ceil(seconds))} seconds`;
  if (seconds < 90 * 60) return `${Math.ceil(seconds / 60)} minutes`;
  if (seconds < 36 * 60 * 60) return `${Math.ceil(seconds / 3600)} hours`;
  return `${Math.ceil(seconds / 86400)} days`;
};

/** Why this member can't open a ticket here right now, as a sentence for them. Null when they can. */
export function whyCannotOpen(attempt: OpenAttempt): string | null {
  const { member, settings, category, stats, openInCategory, channelsInParent, now = Date.now() } = attempt;
  const has = (id: string) => member.roleIds.includes(id);

  if (settings.blocked_role_ids.some(has)) return "You can't open tickets in this server.";
  if (member.timedOut) return "You can't open a ticket while you're timed out.";
  if (category.required_role_ids.length > 0 && !category.required_role_ids.every(has)) {
    return `You don't have the role needed to open a ${category.name} ticket.`;
  }

  if (settings.max_open_per_user !== null && stats.openTotal >= settings.max_open_per_user) {
    return stats.openTotal === 1
      ? "You already have a ticket open. Finish that one first."
      : `You already have ${stats.openTotal} tickets open. Finish one of those first.`;
  }
  const openHere = stats.openByCategory.get(category.slug) ?? 0;
  if (category.member_limit !== null && openHere >= category.member_limit) {
    return openHere === 1
      ? `You already have a ${category.name} ticket open. Finish that one first.`
      : `You already have ${openHere} ${category.name} tickets open. Finish one of those first.`;
  }

  if (category.cooldown_seconds > 0) {
    const last = stats.lastOpenedByCategory.get(category.slug);
    const remaining = last ? category.cooldown_seconds - (now - new Date(last).getTime()) / 1000 : 0;
    if (remaining > 0) return `You opened a ${category.name} ticket a moment ago. Try again in ${waitText(remaining)}.`;
  }

  if (
    (category.total_limit !== null && openInCategory >= category.total_limit) ||
    channelsInParent >= DISCORD_CATEGORY_CHANNELS
  ) {
    return `${category.name} tickets are full right now. Try again later.`;
  }
  return null;
}

// Kept to what the bot has always granted: an overwrite can only hand out a
// permission the bot holds itself, and a create that asks for more fails whole.
const PARTICIPANT = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory];
const BOT = [...PARTICIPANT, PermissionFlagsBits.ManageChannels];

export interface TicketOverwriteInput {
  everyoneRoleId: string;
  botId: string;
  settings: Pick<Settings, "staff_role_id" | "claim_hides_from_other_staff"> | null;
  category: Pick<TicketCategory, "staff_role_ids"> | null;
  ticket: Pick<DiscordTicket, "opener_discord_user_id" | "claimed_by_discord_user_id">;
  /** Members added to the ticket. */
  memberIds: readonly string[];
}

/**
 * The full permission set of a ticket channel. Open, claim, release, add,
 * remove, move and transfer all apply this whole list, so the channel's
 * permissions are always what the data says and never what is left over from
 * an earlier state.
 */
export function computeTicketOverwrites(input: TicketOverwriteInput): OverwriteData[] {
  const { everyoneRoleId, botId, settings, category, ticket, memberIds } = input;
  const claimer = ticket.claimed_by_discord_user_id;
  const hideFromStaff = Boolean(claimer && settings?.claim_hides_from_other_staff);

  const people = new Set<string>(memberIds);
  // An anonymised opener has no Discord account to grant anything to.
  if (ticket.opener_discord_user_id !== "deleted") people.add(ticket.opener_discord_user_id);
  if (claimer) people.add(claimer);
  people.delete(botId);

  return [
    { id: everyoneRoleId, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
    // Claimed and hidden: staff roles get nothing here, so @everyone's deny applies to them too.
    ...(hideFromStaff ? [] : staffRoleIds(settings, category)).map((id) => ({
      id,
      type: OverwriteType.Role,
      allow: PARTICIPANT,
    })),
    ...[...people].map((id) => ({ id, type: OverwriteType.Member, allow: PARTICIPANT })),
    { id: botId, type: OverwriteType.Member, allow: BOT },
  ];
}

const NAME_VARIABLE = /\[([a-z]+\.[a-z_]+)\]/g;

/**
 * A ticket channel's name from the category's template. Discord lowercases
 * names and allows letters, digits, dashes and underscores, so everything else
 * becomes a dash here rather than failing the channel create.
 */
export function renderChannelName(template: string, values: Record<string, string>, fallback: string): string {
  const name = template
    .replace(NAME_VARIABLE, (raw, key: string) => values[key] ?? raw)
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return name || fallback;
}
