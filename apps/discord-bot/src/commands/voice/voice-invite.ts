import { inviteMember, makeInviteLink } from "../../lib/voice/actions";
import { reasonFor, voiceCommand, voiceCommandData } from "../../lib/voice/command";

export default voiceCommand({
  data: voiceCommandData("voice-invite", "Invite someone to the temporary voice channel").addUserOption((opt) =>
    opt.setName("member").setDescription("Who to invite. Leave it empty to get a link for someone outside the server."),
  ),
  ownerOnly: true,
  async run(ctx) {
    const user = ctx.interaction.options.getUser("member");
    if (user) return inviteMember(ctx, user, ctx.interaction.options.getMember("member"));

    const link = await makeInviteLink(ctx.channel, ctx.member, reasonFor(ctx, "Invite link made"));
    if (!link.ok) return link.refusal;
    return [
      `One-time link, good for an hour: ${link.url}`,
      "Send it to who you're inviting. When they join the server through it, they can get in here, even if it's locked.",
    ].join("\n");
  },
});
