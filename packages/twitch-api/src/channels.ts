import { TwitchApiBaseClient } from "./base-client";

export interface UpdateChannelParams {
  title?: string;
  game_id?: string;
}

export class TwitchChannelsClient extends TwitchApiBaseClient {
  /** Update the broadcaster's channel title and/or game. Requires `channel:manage:broadcast` scope. */
  async updateChannelInfo(broadcasterId: string, params: UpdateChannelParams): Promise<void> {
    await this.clientApi().patch("/channels", params, {
      params: { broadcaster_id: broadcasterId },
    });
  }
}
