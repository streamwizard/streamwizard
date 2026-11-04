import type { ChannelInformation } from "@repo/twitch-api";

export interface ChannelInfoResult {
  ok: boolean;
  info?: ChannelInformation;
  /**
   * Box art for `info.game_id`, which `GET /channels` doesn't return.
   *
   * Resolved on the server rather than by the client so opening the tab costs
   * one round trip from the phone instead of two chained ones. Still a Helix
   * template with `{width}`/`{height}` in it — the caller picks the size it
   * renders at.
   */
  boxArtUrl?: string;
  error?: string;
}
