import { AttachmentBuilder, DiscordAPIError, RESTJSONErrorCodes, type Guild } from "discord.js";
import { parseTicketMessages, replaceVariables } from "@repo/discord-message";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { listTicketMessages } from "@repo/supabase/queries/ticket-archive";
import type { DiscordTicket } from "@repo/supabase/queries/tickets";
import { guildVariableValues } from "../built-message";
import { findCategory, getTicketConfig, type TicketConfig } from "./config";
import { ticketVariableValues } from "./intro";
import { renderTranscriptText, transcriptFileName } from "./transcript-file";

// The opener's copy of a closed ticket: the dashboard-editable text plus the
// conversation as a file. Best effort. A member with DMs off, or one who left,
// can't be reached, and that is not an error.

/** The transcript file for a ticket, from the archive. */
export async function buildTranscriptFile(guild: Guild, ticket: DiscordTicket, config: TicketConfig): Promise<AttachmentBuilder> {
  const rows = await listTicketMessages(supabase, ticket.id);
  const text = renderTranscriptText(ticket, rows, {
    serverName: guild.name,
    categoryName: findCategory(config, ticket.category)?.name ?? ticket.category,
  });
  return new AttachmentBuilder(Buffer.from(text, "utf8"), { name: transcriptFileName(ticket.ticket_number) });
}

export async function sendCloseDm(guild: Guild, ticket: DiscordTicket): Promise<void> {
  try {
    const config = await getTicketConfig(guild.id);
    if (!config.settings?.dm_on_close) return;

    const content = replaceVariables(parseTicketMessages(config.settings.messages).closeDm, {
      ...guildVariableValues(guild),
      ...ticketVariableValues(ticket, config),
      "ticket.close_reason": ticket.close_reason ?? "",
      "ticket.closed_by": ticket.closed_by_name ?? "StreamWizard",
    });
    const file = await buildTranscriptFile(guild, ticket, config);
    const user = await guild.client.users.fetch(ticket.opener_discord_user_id);
    await user.send({ content: content.slice(0, 2000), files: [file] });
  } catch (error) {
    // DMs off, or no server in common any more: nothing to do about it.
    if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.CannotSendMessagesToThisUser) return;
    reportError(error, "discord-bot tickets: close DM", { ticketId: ticket.id });
  }
}
