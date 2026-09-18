import { Events } from "discord.js";
import { getGuildWelcomeSettings, grantJoinRole } from "../lib/welcome";
import type { BotEvent } from "../types/discord";

// Members in Membership Screening are skipped on join; give them the join role
// once they accept the rules.
export default {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    if (!oldMember.pending || newMember.pending) return;
    const settings = await getGuildWelcomeSettings(newMember.guild);
    await grantJoinRole(newMember, settings?.join_role_id);
  },
} satisfies BotEvent<typeof Events.GuildMemberUpdate>;
