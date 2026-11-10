"use server";

import { TwitchApi } from "@repo/twitch-api";
import { track } from "@/lib/tracking/track";
import { reportError } from "@repo/sentry";
import { tryAuthContext } from "@/lib/auth";
import { updateChannelInfoSchema } from "@/schemas/twitch";
import type { ChannelInfoResult } from "@/types/twitch-channel";

/**
 * Reading and writing the signed-in streamer's own channel info.
 *
 * The broadcaster id comes from the session (tryAuthContext) and is never
 * taken from the caller — an id in the argument list is an id a client can
 * change, which would turn this into a way to rewrite other people's titles.
 */

export async function getMyChannelInfo(): Promise<ChannelInfoResult> {
  const ctx = await tryAuthContext();
  if (!ctx) return { ok: false, error: "Not signed in" };
  const twitchUserId = ctx.broadcasterId;

  try {
    const api = new TwitchApi(twitchUserId);
    const info = await api.channels.getChannelInformation(twitchUserId);
    if (!info) return { ok: false, error: "Twitch didn't return your channel" };

    // A channel with no category set has no art to fetch, and a lookup that
    // fails shouldn't cost the streamer their title — the picker falls back to
    // a placeholder on its own.
    let boxArtUrl: string | undefined;
    if (info.game_id) {
      try {
        boxArtUrl = (await api.search.lookupGame(info.game_id))?.box_art_url;
      } catch (error) {
        reportError(error, "getMyChannelInfo:boxArt");
      }
    }

    return { ok: true, info, boxArtUrl };
  } catch (error) {
    reportError(error, "getMyChannelInfo");
    return { ok: false, error: "Couldn't load your channel info" };
  }
}

interface UpdateChannelInfoResult {
  ok: boolean;
  error?: string;
}

export async function updateChannelInfo(params: {
  title?: string;
  gameId?: string;
}): Promise<UpdateChannelInfoResult> {
  const ctx = await tryAuthContext();
  if (!ctx) return { ok: false, error: "Not signed in" };
  const parsed = updateChannelInfoSchema.safeParse(params);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid channel info" };
  const twitchUserId = ctx.broadcasterId;

  try {
    const api = new TwitchApi(twitchUserId);
    await api.channels.updateChannelInfo(twitchUserId, {
      title: parsed.data.title,
      game_id: parsed.data.gameId,
    });
    await track("stream_info_updated", {}, ctx.user);
    return { ok: true };
  } catch (error) {
    reportError(error, "updateChannelInfo");
    return { ok: false, error: "Twitch wouldn't accept that change" };
  }
}
