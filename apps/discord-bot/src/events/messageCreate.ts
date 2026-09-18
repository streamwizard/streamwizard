import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } from "discord.js";
import { TtlCache } from "@repo/ttl-cache";
import { reportError } from "@repo/sentry";
import { recordMessage } from "../lib/activity-tracker";
import { notifyTicketActivity } from "../lib/ticket-activity";
import { archiveNewMessage } from "../lib/tickets/archive";
import { TICKET_IDS } from "../lib/tickets/ids";
import { findDmTicketGuild } from "../lib/tickets/open";
import type { BotEvent } from "../types/discord";
import type { Message } from "discord.js";

// A DM to the bot is only ever an invitation to open a ticket, and only when
// a server turned that on. The text of the DM is not read or stored; the
// reply is a button that starts the usual category-then-form flow.

const DM_REPLY_TTL_MS = 10 * 60 * 1000;
/** One "want a ticket?" per person per ten minutes, so a chatty DM isn't answered line by line. */
const recentDmReplies = new TtlCache<true>({ ttlMs: DM_REPLY_TTL_MS });

async function offerTicketFromDm(message: Message): Promise<void> {
  if (message.author.bot || !message.client.isReady()) return;
  if (recentDmReplies.get(message.author.id)) return;
  try {
    const found = await findDmTicketGuild(message.client, message.author);
    if (!found) return;
    recentDmReplies.set(message.author.id, true);
    await message.reply({
      content: `Need a hand in **${found.guild.name}**? Open a ticket and the team will pick it up there.`,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(TICKET_IDS.create).setLabel("Create ticket").setEmoji("🎫").setStyle(ButtonStyle.Primary),
        ),
      ],
    });
  } catch (error) {
    reportError(error, "discord-bot tickets: DM offer", { userId: message.author.id });
  }
}

export default {
  name: Events.MessageCreate,
  execute(message) {
    void recordMessage(message);
    if (message.guildId) {
      void archiveNewMessage(message);
      void notifyTicketActivity(message.guildId, message.channelId, "message");
    } else {
      void offerTicketFromDm(message);
    }
  },
} satisfies BotEvent<typeof Events.MessageCreate>;
