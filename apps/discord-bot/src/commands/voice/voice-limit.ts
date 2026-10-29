import { VOICE_USER_LIMIT_MAX } from "@repo/supabase/queries/discord-voice";
import { reasonFor, voiceCommand, voiceCommandData } from "../../lib/voice/command";

export default voiceCommand({
  data: voiceCommandData("voice-limit", "Change the user limit of the temporary voice channel").addIntegerOption((opt) =>
    opt
      .setName("user_limit")
      .setDescription(`How many people fit, up to ${VOICE_USER_LIMIT_MAX}. 0 removes the limit.`)
      .setMinValue(0)
      .setMaxValue(VOICE_USER_LIMIT_MAX)
      .setRequired(true),
  ),
  ownerOnly: true,
  async run(ctx) {
    const limit = ctx.interaction.options.getInteger("user_limit", true);
    if (limit === ctx.channel.userLimit) return limit === 0 ? "There's no limit already." : `The limit is already ${limit}.`;
    await ctx.channel.setUserLimit(limit, reasonFor(ctx, "User limit changed"));
    return limit === 0 ? "No user limit now." : `Limit set to ${limit}.`;
  },
});
