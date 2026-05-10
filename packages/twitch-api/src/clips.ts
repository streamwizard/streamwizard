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

  async getClips(options: Helix.GetClipsParams): Promise<Helix.GetClipsResponse> {
    const response = await this.appApi().get<Helix.GetClipsResponse>("/clips", {
      params: options,
    });
    return response.data;
  }

  async createClip(params: Omit<Helix.CreateClipParams, "broadcaster_id"> = {}): Promise<Helix.CreateClipResponse> {
    const response = await this.clientApi().post<Helix.CreateClipResponse>("/clips", null, {
      params: {
        broadcaster_id: this.broadcaster_id,
        ...params,
      } as Helix.CreateClipParams,
    });
    return response.data;
  }

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

  async getClipDownloadUrl(params: {
    broadcaster_id: string;
    editor_id: string;
    clip_id: string;
  }): Promise<{ data: ClipDownloadUrl[] }> {
    const response = await this.appApi().get("/clips/downloads", { params });
    return response.data;
  }
}
