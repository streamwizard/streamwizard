import { TwitchApiBaseClient } from "./base-client";

/**
 * Get Ad Schedule, as Twitch sends it. Twitch documents the times as RFC3339
 * and the numbers as strings, but has been seen sending unix seconds, so
 * callers should accept both (see toPublicAdSchedule in @repo/twitch-assets).
 */
export interface AdSchedule {
  next_ad_at: string | number | null;
  last_ad_at: string | number | null;
  duration: string | number | null;
  preroll_free_time: string | number | null;
  snooze_count: string | number | null;
  snooze_refresh_at: string | number | null;
}

export class TwitchAdsClient extends TwitchApiBaseClient {
  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }

  /**
   * The channel's ad schedule: the next ad, its length and the snoozes left.
   * Needs the broadcaster's token with channel:read:ads. Null when Twitch
   * returns nothing.
   */
  async getAdSchedule(): Promise<AdSchedule | null> {
    const response = await this.clientApi().get("/channels/ads", {
      params: { broadcaster_id: this.broadcaster_id },
    });
    return response.data?.data?.[0] ?? null;
  }
}
