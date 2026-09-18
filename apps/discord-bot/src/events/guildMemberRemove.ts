import { Events } from "discord.js";
import type { BotEvent } from "../types/discord";
import { closeTicketsOfDepartedMember } from "../lib/tickets";

// Whoever opened a ticket and left can't answer in it anymore. Servers that
// turned "close when the opener leaves" on get those tickets saved and closed.
// (The leave itself is logged by events/server-log/memberLeft.ts.)
export default {
  name: Events.GuildMemberRemove,
  async execute(member) {
    await closeTicketsOfDepartedMember(member.guild, member.id);
  },
} satisfies BotEvent<typeof Events.GuildMemberRemove>;
