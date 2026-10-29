import { MessageFlags, type ButtonInteraction, type ModalSubmitInteraction } from "discord.js";
import { reportError } from "@repo/sentry";
import { canRunCommand } from "../permissions";
import { inviteMember, makeInviteLink, resetChannel } from "./actions";
import { isVoiceStaff, reasonFor, resolveContext, runVoiceAction } from "./command";
import {
  buildVoiceInviteModal,
  VOICE_INVITE_BUTTON_ID,
  VOICE_INVITE_MEMBERS_FIELD,
  VOICE_INVITE_MODAL_ID,
  VOICE_RESET_BUTTON_ID,
} from "./help";
import { ownerRefusal } from "./rules";
import { getStaffRoleIds } from "./store";

// Buttons on a temp channel's pinned message, and the Invite modal. Each does
// what its /voice-* command does, behind the same command permission set in
// the dashboard.

const COMMAND_FOR: Record<string, string> = {
  [VOICE_INVITE_BUTTON_ID]: "voice-invite",
  [VOICE_RESET_BUTTON_ID]: "voice-reset",
  [VOICE_INVITE_MODAL_ID]: "voice-invite",
};

export function isVoiceInteraction(customId: string): boolean {
  return Object.hasOwn(COMMAND_FOR, customId);
}

export async function handleVoiceInteraction(interaction: ButtonInteraction | ModalSubmitInteraction): Promise<void> {
  try {
    if (!interaction.inCachedGuild()) return;
    if (!(await canRunCommand(interaction.member, COMMAND_FOR[interaction.customId]!))) {
      await interaction.reply({ content: "You don't have permission to use this.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (interaction.isModalSubmit()) await submitInvite(interaction);
    else if (interaction.customId === VOICE_INVITE_BUTTON_ID) await openInvite(interaction);
    else await runVoiceAction(interaction, "the Reset button", { ownerOnly: true, run: resetChannel });
  } catch (error) {
    reportError(error, "discord-bot voice: button", { customId: interaction.customId });
    const content = "Something went wrong with that.";
    if (interaction.replied || interaction.deferred) await interaction.editReply({ content }).catch(() => {});
    else await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

/**
 * Shows the Invite modal. A modal has to be the first answer, within three
 * seconds, so the owner check and the link happen here, outside the channel's
 * queue: making a link changes nothing about the channel itself.
 */
async function openInvite(interaction: ButtonInteraction<"cached">): Promise<void> {
  const found = await resolveContext(interaction, "the Invite button");
  const staff = found ? isVoiceStaff(found.member, await getStaffRoleIds(found.temp.guildId, found.temp.hubId)) : false;
  const refusal = !found ? "This channel is gone." : staff ? null : ownerRefusal(found.member.id, found.temp, found.ownerPresent);
  if (!found || refusal) {
    await interaction.reply({ content: refusal ?? "", flags: MessageFlags.Ephemeral });
    return;
  }
  const link = await makeInviteLink(found.channel, found.member, reasonFor(found, "Invite link made")).catch(
    (error: unknown) => {
      reportError(error, "discord-bot voice: invite link", { channelId: found.channel.id });
      return { ok: false as const, refusal: "I couldn't make a link right now. You can still pick people who are already in the server." };
    },
  );
  await interaction.showModal(buildVoiceInviteModal(link));
}

/** The members picked in the Invite modal, each invited like /voice-invite @member. */
async function submitInvite(interaction: ModalSubmitInteraction<"cached">): Promise<void> {
  const users = interaction.fields.getSelectedUsers(VOICE_INVITE_MEMBERS_FIELD) ?? new Map();
  await runVoiceAction(interaction, "the Invite button", {
    ownerOnly: true,
    async run(ctx) {
      if (users.size === 0) return "Nobody picked. If you copied the link, it's good for an hour.";
      const answers: string[] = [];
      for (const user of users.values()) {
        const member = await ctx.channel.guild.members.fetch(user.id).catch(() => null);
        answers.push(await inviteMember(ctx, user, member));
      }
      return answers.join("\n");
    },
  });
}
