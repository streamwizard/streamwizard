"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getDiscordUserIdForUser } from "@repo/supabase/queries/discord";
import { getTicketByNumber } from "@repo/supabase/queries/tickets";
import { getUserDisplayProfile } from "@repo/supabase/queries/user";
import { resolveDiscordProfiles } from "@/lib/discord/users";
import { DashboardError, requireDiscordAdmin, toActionError, type DiscordActionResult } from "@/lib/discord/action";
import { callBot } from "@/lib/discord/bot-bridge";

// Claim and close from the ticket page. The bot does the work as the admin's
// linked Discord account, so the ticket, timeline and channel show who did it.

const ticketNumberSchema = z.number().int().positive();

async function prepare(ticketNumber: number) {
  const { userId, guildId } = await requireDiscordAdmin();
  if (!ticketNumberSchema.safeParse(ticketNumber).success) throw new DashboardError("Invalid ticket");

  const discordUserId = await getDiscordUserIdForUser(supabaseAdmin, userId);
  if (!discordUserId) throw new DashboardError("Link your Discord account in StreamWizard first. Claims and closes are made as you.");

  const ticket = await getTicketByNumber(supabaseAdmin, guildId, ticketNumber);
  if (!ticket) throw new DashboardError("That ticket doesn't exist");
  if (ticket.status !== "open") throw new DashboardError("This ticket is already closed");
  return { guildId, discordUserId, ticket };
}

function revalidate(ticketNumber: number) {
  revalidatePath("/discord/tickets");
  revalidatePath(`/discord/tickets/${ticketNumber}`);
}

export async function claimTicketFromDashboard(ticketNumber: number): Promise<DiscordActionResult> {
  try {
    const { guildId, discordUserId, ticket } = await prepare(ticketNumber);
    if (ticket.claimed_by_discord_user_id) throw new DashboardError("Someone already claimed this ticket");

    const result = await callBot(guildId, `/tickets/${ticket.channel_id}/claim`, { discordUserId });
    if (!result.ok) throw new DashboardError(result.error);

    revalidate(ticketNumber);
    return { error: null };
  } catch (error) {
    return toActionError(error, "claim ticket", "Couldn't claim the ticket. Try again?");
  }
}

export async function closeTicketFromDashboard(ticketNumber: number): Promise<DiscordActionResult> {
  try {
    const { guildId, discordUserId, ticket } = await prepare(ticketNumber);

    // Saving the transcript (and copying images) happens before the channel
    // goes, which can take a while on long tickets.
    const result = await callBot(guildId, `/tickets/${ticket.channel_id}/close`, { discordUserId }, { timeoutMs: 60_000 });
    if (!result.ok) throw new DashboardError(result.error);

    revalidate(ticketNumber);
    return { error: null };
  } catch (error) {
    return toActionError(error, "close ticket", "Couldn't close the ticket. Try again?");
  }
}

const replySchema = z.string().trim().min(1, "Write something first").max(2000, "Keep it under 2000 characters");

/**
 * Posts a staff reply in the ticket channel. The bot sends it with the
 * sender's name and avatar as credit: their Discord profile when linked,
 * otherwise their StreamWizard name and Twitch avatar.
 */
export async function sendTicketReply(ticketNumber: number, content: string): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const parsed = replySchema.safeParse(content);
    if (!parsed.success) throw new DashboardError(parsed.error.issues[0]?.message ?? "Invalid message");
    if (!ticketNumberSchema.safeParse(ticketNumber).success) throw new DashboardError("Invalid ticket");

    const ticket = await getTicketByNumber(supabaseAdmin, guildId, ticketNumber);
    if (!ticket || ticket.status !== "open") throw new DashboardError("This ticket isn't open anymore");

    const discordUserId = await getDiscordUserIdForUser(supabaseAdmin, userId);
    const discordProfile = discordUserId ? (await resolveDiscordProfiles([discordUserId])).get(discordUserId) : undefined;
    const fallback = discordProfile ? null : await getUserDisplayProfile(supabaseAdmin, userId);

    const result = await callBot(guildId, `/tickets/${ticket.channel_id}/message`, {
      authorName: discordProfile?.name ?? fallback?.name ?? "StreamWizard staff",
      authorAvatarUrl: discordProfile?.avatarUrl ?? fallback?.avatarUrl ?? null,
      content: parsed.data,
    });
    if (!result.ok) throw new DashboardError(result.error);

    revalidate(ticketNumber);
    return { error: null };
  } catch (error) {
    return toActionError(error, "ticket reply", "Couldn't send the message. Try again?");
  }
}
