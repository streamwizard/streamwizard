"use server";

import { TwitchApi } from "@repo/twitch-api";

export async function updateChannelInfo(
  broadcasterId: string,
  params: { title?: string; gameId?: string }
) {
  const api = new TwitchApi(broadcasterId);
  await api.channels.updateChannelInfo(broadcasterId, {
    title: params.title,
    game_id: params.gameId,
  });
}
