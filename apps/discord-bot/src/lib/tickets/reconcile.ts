import { ChannelType, DiscordAPIError, RESTJSONErrorCodes, type Client } from "discord.js";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { listOpenTicketRefs } from "@repo/supabase/queries/ticket-archive";
import { reconcileTicketTranscript } from "../ticket-transcript";
import { closeOrphanedTicket } from "./close";

/**
 * At startup: every open ticket's channel is walked once and whatever the
 * live archive missed is inserted; a ticket whose channel no longer exists is
 * closed as channel_deleted. Sequential on purpose: this is a catch-up, not a
 * race, and the gateway has just connected.
 */
export async function reconcileOpenTickets(client: Client<true>): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    let refs;
    try {
      refs = await listOpenTicketRefs(supabase, guild.id);
    } catch (error) {
      reportError(error, "discord-bot tickets: list open for reconcile", { guildId: guild.id });
      continue;
    }

    for (const ref of refs.values()) {
      try {
        const channel = await guild.channels.fetch(ref.channelId);
        if (channel?.type !== ChannelType.GuildText) continue;
        await reconcileTicketTranscript(channel, { id: ref.ticketId, guild_id: guild.id });
      } catch (error) {
        // Only a channel Discord says is gone counts as gone: a network blip must not close tickets.
        if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownChannel) {
          await closeOrphanedTicket(guild, ref.channelId).catch((closeError) =>
            reportError(closeError, "discord-bot tickets: close orphan", { ticketId: ref.ticketId }),
          );
          continue;
        }
        reportError(error, "discord-bot tickets: reconcile", { ticketId: ref.ticketId });
      }
    }
  }
}
