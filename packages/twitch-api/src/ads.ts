import { TwitchApiBaseClient } from "./base-client";

export class TwitchAdsClient extends TwitchApiBaseClient {
  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }

  async getAdSchedule(): Promise<unknown> {
    const response = await this.clientApi().get("/channels/ads", {
      params: { broadcaster_id: this.broadcaster_id },
    });
    return response.data;
  }
}
