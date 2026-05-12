import { TwitchApiBaseClient } from "./base-client";

export interface UpdateChannelParams {
  title?: string;
  game_id?: string;
}

export class TwitchChannelsClient extends TwitchApiBaseClient {
  async updateChannelInfo(broadcasterId: string, params: UpdateChannelParams): Promise<void> {
    await this.clientApi().patch("/channels", params, {
      params: { broadcaster_id: broadcasterId },
    });
  }
}
