import type { MinecraftActions } from "@/classes/minecraft/handle-minecraft-actions";
import { TwitchApi } from "@repo/twitch-api";
import { ChannelPointsCustomRewardRedemptionAddEvent } from "@repo/schemas";

export async function handleChannelChannelPointsCustomRewardRedemptionAdd(
  event: ChannelPointsCustomRewardRedemptionAddEvent,
  twitchApi: TwitchApi,
  minecraftActions: MinecraftActions,
) {
  console.log(
    `[${event.broadcaster_user_name}] ${event.user_name} redeemed ${event.reward.title} `,
  );


  // TODO: BUGGY AS HELL
  // await minecraftActions.Jumpscares.endermanScare();



  await minecraftActions.Jumpscares.spinningPlayer();




}
