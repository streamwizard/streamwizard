import { TwitchApiBaseClient } from "./base-client";
import { Helix } from "@repo/types";

export interface ClipDownloadUrl {
  clip_id: string;
  landscape_download_url: string | null;
  portrait_download_url: string | null;
}

export class TwitchClipsClient extends TwitchApiBaseClient {
  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }

  /** Retrieve clips for a broadcaster, game, or by clip ID. */
  async getClips(options: Helix.GetClipsParams): Promise<Helix.GetClipsResponse> {
    const response = await this.appApi().get<Helix.GetClipsResponse>("/clips", {
      params: options,
    });
    return response.data;
  }

  /** Create a clip from the broadcaster's live stream. Requires `clips:edit` scope. */
  async createClip(params: Omit<Helix.CreateClipParams, "broadcaster_id"> = {}): Promise<Helix.CreateClipResponse> {
    const response = await this.clientApi().post<Helix.CreateClipResponse>("/clips", null, {
      params: {
        broadcaster_id: this.broadcaster_id,
        ...params,
      } as Helix.CreateClipParams,
    });
    return response.data;
  }

  /** Create a clip from a VOD segment. Requires `clips:edit` scope. */
  async createClipFromVod(
    params: Omit<Helix.CreateClipFromVodParams, "broadcaster_id" | "editor_id">
  ): Promise<Helix.CreateClipFromVodResponse> {
    const response = await this.clientApi().post<Helix.CreateClipFromVodResponse>("/videos/clips", null, {
      params: {
        editor_id: this.broadcaster_id,
        broadcaster_id: this.broadcaster_id,
        ...params,
      } as Helix.CreateClipFromVodParams,
    });
    return response.data;
  }

  /** Retrieve download URLs (landscape and portrait) for a clip. */
  async getClipDownloadUrl(params: {
    broadcaster_id: string;
    editor_id: string;
    clip_id: string;
  }): Promise<{ data: ClipDownloadUrl[] }> {
    const response = await this.appApi().get("/clips/downloads", { params });
    return response.data;
  }
}
